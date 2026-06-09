"""
HTJR Wi-Fi drone stream/control runtime.

This service intentionally does not import the old pygame control scripts. It
keeps the working RTSP/RTP/JPEG repair and 13-byte control packet logic local to
the API app so the FastAPI router can call it lazily.
"""

from __future__ import annotations

import asyncio
import random
import re
import socket
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import AsyncIterator, Awaitable, Callable

from services.file_service import UPLOADS_DIR


DEFAULT_DRONE_IP = "192.168.1.1"
DEFAULT_RTSP_PORT = 7070
DEFAULT_RTSP_URL = "rtsp://192.168.1.1:7070/webcam"
APK_SPEED_BYTES = (30, 60, 100)


def clamp_byte(value: int) -> int:
    return max(0, min(255, int(value)))


def normalize_speed_byte(value: int) -> int:
    if value in APK_SPEED_BYTES:
        return value
    return min(APK_SPEED_BYTES, key=lambda speed: abs(speed - value))


@dataclass
class DroneConfig:
    host: str = DEFAULT_DRONE_IP
    port: int = DEFAULT_RTSP_PORT
    url: str = DEFAULT_RTSP_URL
    client_port_base: int | None = None
    verbose_rtsp: bool = False
    speed: int = 30
    axis_delta: int = 90
    hover_throttle: int = 128
    trim_ail: int = 164
    trim_ele: int = 128
    trim_rudd: int = 128
    send_interval: float = 0.04
    capture_dir: str = str(UPLOADS_DIR / "drone")


@dataclass
class DronePhoto:
    file_path: str
    url: str


@dataclass
class HtjrPacketState:
    ail: int = 128
    ele: int = 128
    thr: int = 128
    rudd: int = 128
    speed: int = 30
    altitude_hold: bool = True
    flyup: bool = False
    flydown: bool = False
    return_mode: bool = False
    fixed_direction_rotate: bool = False
    headless: bool = False
    rotate: bool = False
    emergency_down: bool = False
    gyro_calibrate: bool = False
    trim_ele: int = 128
    trim_ail: int = 128
    trim_rudd: int = 128
    light: bool = False
    roll_flip: bool = False


def scaled_axis_byte(value: int, speed: int, roll_flip: bool) -> int:
    value = clamp_byte(value)
    if roll_flip:
        return value
    factor = normalize_speed_byte(speed) / 100.0
    if value < 128:
        return 128 - int((128 - value) * factor)
    if value > 128:
        return 128 + int((value - 128) * factor)
    return value


def build_htjr_packet(state: HtjrPacketState) -> bytes:
    speed = normalize_speed_byte(state.speed)
    ail = scaled_axis_byte(state.ail, speed, state.roll_flip)
    ele = scaled_axis_byte(state.ele, speed, state.roll_flip)
    thr = clamp_byte(state.thr)
    rudd = clamp_byte(state.rudd)
    speed_flags = (speed << 1) | int(state.altitude_hold)
    checksum = ail ^ ele ^ thr ^ rudd ^ speed_flags
    mode_flags = (
        int(state.flyup)
        | (int(state.flydown) << 1)
        | (int(state.return_mode) << 2)
        | (int(state.fixed_direction_rotate) << 3)
        | (int(state.headless) << 4)
        | (int(state.rotate) << 5)
        | (int(state.emergency_down) << 6)
        | (int(state.gyro_calibrate) << 7)
    )
    extra_flags = (int(state.light) << 1) | int(state.roll_flip)
    return bytes(
        [
            0x66,
            ail,
            ele,
            thr,
            rudd,
            speed_flags,
            checksum,
            0x99,
            clamp_byte(state.trim_ele),
            clamp_byte(state.trim_ail),
            clamp_byte(state.trim_rudd),
            mode_flags,
            extra_flags,
        ]
    )


class RtspUdpSession:
    def __init__(
        self,
        host: str,
        port: int,
        url: str,
        client_port_base: int | None = None,
        verbose: bool = False,
    ) -> None:
        self.host = host
        self.port = port
        self.url = url
        self.verbose = verbose
        self.cseq = 1
        self.session: str | None = None
        self.server_rtp_port: int | None = None
        self.server_rtcp_port: int | None = None
        self.last_rtp_addr: tuple[str, int] | None = None
        self.last_rtcp_addr: tuple[str, int] | None = None
        self.sdp = ""
        self.video_payload_type: int | None = None
        self.video_codec: str | None = None
        self.rtp_callbacks: list[Callable[[bytes], None]] = []
        self.running = False

        self.tcp = socket.create_connection((self.host, self.port), timeout=5)
        self.rtp, self.rtcp, self.client_rtp_port, self.client_rtcp_port = (
            self._bind_udp_pair(client_port_base)
        )
        for sock in (self.rtp, self.rtcp):
            try:
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 4 * 1024 * 1024)
            except OSError:
                pass
        self.rtp.settimeout(0.2)
        self.rtcp.settimeout(0.2)

    def _bind_udp_pair(
        self, requested_base: int | None
    ) -> tuple[socket.socket, socket.socket, int, int]:
        bases: list[int] = []
        if requested_base is not None:
            bases.append(requested_base if requested_base % 2 == 0 else requested_base - 1)
        bases.extend(random.randrange(10000, 40000, 2) for _ in range(100))

        last_error: OSError | None = None
        for base in bases:
            rtp = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            rtcp = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            try:
                rtp.bind(("", base))
                rtcp.bind(("", base + 1))
                return rtp, rtcp, base, base + 1
            except OSError as exc:
                last_error = exc
                rtp.close()
                rtcp.close()
        raise RuntimeError(f"Could not bind local RTP/RTCP ports: {last_error}")

    def request(self, method: str, url: str, extra_headers: str = "") -> str:
        msg = (
            f"{method} {url} RTSP/1.0\r\n"
            f"CSeq: {self.cseq}\r\n"
            "User-Agent: HTJR-FastAPI-Python\r\n"
            f"{extra_headers}"
            "\r\n"
        )
        self.cseq += 1
        if self.verbose:
            print(f"\n[RTSP] >>> {method} {url}")
            print(msg.rstrip())
        self.tcp.sendall(msg.encode("ascii"))
        response = self._read_response()
        if self.verbose:
            print("[RTSP] <<<")
            print(response.split("\r\n\r\n", 1)[0])
        return response

    def _read_response(self) -> str:
        data = b""
        while b"\r\n\r\n" not in data:
            chunk = self.tcp.recv(4096)
            if not chunk:
                raise RuntimeError("RTSP connection closed while reading headers")
            data += chunk
        header, body = data.split(b"\r\n\r\n", 1)
        header_text = header.decode("latin1", errors="replace")
        content_length = 0
        for line in header_text.splitlines():
            if line.lower().startswith("content-length:"):
                content_length = int(line.split(":", 1)[1].strip())
                break
        while len(body) < content_length:
            chunk = self.tcp.recv(content_length - len(body))
            if not chunk:
                raise RuntimeError("RTSP connection closed while reading body")
            body += chunk
        return header_text + "\r\n\r\n" + body.decode("latin1", errors="replace")

    @staticmethod
    def _status_code(response: str) -> int | None:
        first = response.splitlines()[0] if response else ""
        match = re.search(r"RTSP/\S+\s+(\d+)", first)
        return int(match.group(1)) if match else None

    @staticmethod
    def _header(response: str, name: str) -> str | None:
        needle = name.lower() + ":"
        for line in response.splitlines():
            if line.lower().startswith(needle):
                return line.split(":", 1)[1].strip()
        return None

    def _control_url_from_describe(self, describe: str) -> str:
        content_base = self._header(describe, "Content-Base")
        base = content_base or self.url
        for line in describe.splitlines():
            line = line.strip()
            if not line.startswith("a=control:"):
                continue
            value = line.split(":", 1)[1].strip()
            if value == "*":
                return self.url
            if value.startswith("rtsp://"):
                return value
            return base.rstrip("/") + "/" + value.lstrip("/")
        return self.url.rstrip("/") + "/track0"

    def connect(self) -> None:
        options = self.request("OPTIONS", self.url)
        self._require_ok(options, "OPTIONS")
        describe = self.request("DESCRIBE", self.url, "Accept: application/sdp\r\n")
        self._require_ok(describe, "DESCRIBE")
        self.sdp = describe.split("\r\n\r\n", 1)[1] if "\r\n\r\n" in describe else ""
        self._parse_sdp_media()

        control_url = self._control_url_from_describe(describe)
        print("[RTSP] control URL:", control_url)
        if self.video_codec:
            print("[RTSP] video:", self.video_payload_type, self.video_codec)

        setup = self._setup_udp(control_url)
        self.session = self._parse_session(setup)
        self._parse_transport(setup)
        print("[RTSP] session:", self.session)
        print("[RTSP] client RTP/RTCP:", self.client_rtp_port, self.client_rtcp_port)
        print("[RTSP] server RTP/RTCP:", self.server_rtp_port, self.server_rtcp_port)

        play = self.request(
            "PLAY",
            self.url,
            f"Session: {self.session}\r\nRange: npt=0.000-\r\n",
        )
        self._require_ok(play, "PLAY")
        self.running = True
        threading.Thread(target=self._drain_rtp, daemon=True).start()
        threading.Thread(target=self._drain_rtcp, daemon=True).start()
        self._ensure_remote_rtcp_port()

    def _setup_udp(self, control_url: str) -> str:
        transports = ["RTP/AVP;unicast", "RTP/AVP/UDP;unicast"]
        last_response = ""
        for transport in transports:
            setup = self.request(
                "SETUP",
                control_url,
                (
                    f"Transport: {transport};"
                    f"client_port={self.client_rtp_port}-{self.client_rtcp_port}\r\n"
                ),
            )
            last_response = setup
            if self._status_code(setup) == 200:
                return setup
        raise RuntimeError("SETUP failed:\n" + last_response.split("\r\n\r\n", 1)[0])

    def _require_ok(self, response: str, method: str) -> None:
        code = self._status_code(response)
        if code != 200:
            raise RuntimeError(
                f"{method} failed with RTSP status {code}:\n"
                + response.split("\r\n\r\n", 1)[0]
            )

    def _parse_session(self, response: str) -> str:
        value = self._header(response, "Session")
        if not value:
            raise RuntimeError("SETUP succeeded but did not return a Session header")
        return value.split(";", 1)[0].strip()

    def _parse_transport(self, response: str) -> None:
        transport = self._header(response, "Transport") or ""
        print("[RTSP] transport:", transport)
        match = re.search(r"server_port=(\d+)-(\d+)", transport, re.I)
        if match:
            self.server_rtp_port = int(match.group(1))
            self.server_rtcp_port = int(match.group(2))

    def _parse_sdp_media(self) -> None:
        video_payloads: list[int] = []
        in_video = False
        for line in self.sdp.splitlines():
            line = line.strip()
            if line.startswith("m="):
                parts = line.split()
                in_video = bool(parts and parts[0].lower() == "m=video")
                if in_video:
                    video_payloads = [int(part) for part in parts[3:] if part.isdigit()]
                    if video_payloads:
                        self.video_payload_type = video_payloads[0]
                continue
            if not in_video:
                continue
            match = re.match(r"a=rtpmap:(\d+)\s+([^/\s;]+)", line, re.I)
            if match:
                payload_type = int(match.group(1))
                if video_payloads and payload_type not in video_payloads:
                    continue
                self.video_payload_type = payload_type
                self.video_codec = match.group(2).upper()
                return
        if self.video_codec is None and self.video_payload_type == 26:
            self.video_codec = "JPEG"

    def add_rtp_callback(self, callback: Callable[[bytes], None]) -> None:
        self.rtp_callbacks.append(callback)

    def _ensure_remote_rtcp_port(self) -> None:
        if self.server_rtcp_port is not None:
            return
        deadline = time.time() + 2.0
        while time.time() < deadline:
            if self.last_rtcp_addr:
                self.server_rtcp_port = self.last_rtcp_addr[1]
                return
            if self.last_rtp_addr:
                self.server_rtp_port = self.last_rtp_addr[1]
                self.server_rtcp_port = self.last_rtp_addr[1] + 1
                return
            time.sleep(0.05)
        raise RuntimeError("Could not determine the drone's RTCP port")

    def _drain_rtp(self) -> None:
        while self.running:
            try:
                data, addr = self.rtp.recvfrom(65535)
                self.last_rtp_addr = addr
                for callback in tuple(self.rtp_callbacks):
                    callback(data)
            except socket.timeout:
                continue
            except OSError:
                break

    def _drain_rtcp(self) -> None:
        while self.running:
            try:
                _, addr = self.rtcp.recvfrom(65535)
                self.last_rtcp_addr = addr
            except socket.timeout:
                continue
            except OSError:
                break

    def send_control(self, packet: bytes) -> None:
        if self.server_rtcp_port is None:
            raise RuntimeError("No server RTCP port known yet")
        self.rtcp.sendto(packet, (self.host, self.server_rtcp_port))

    def close(self) -> None:
        self.running = False
        try:
            self.tcp.settimeout(0.5)
            if self.session:
                self.request("TEARDOWN", self.url, f"Session: {self.session}\r\n")
        except Exception:
            pass
        for sock in (self.tcp, self.rtp, self.rtcp):
            try:
                sock.shutdown(socket.SHUT_RDWR)
            except Exception:
                pass
            try:
                sock.close()
            except Exception:
                pass


@dataclass
class RtpPacket:
    marker: bool
    payload_type: int
    sequence: int
    timestamp: int
    payload: bytes


def parse_rtp_packet(data: bytes) -> RtpPacket | None:
    if len(data) < 12 or data[0] >> 6 != 2:
        return None
    csrc_count = data[0] & 0x0F
    has_extension = bool(data[0] & 0x10)
    has_padding = bool(data[0] & 0x20)
    header_len = 12 + (csrc_count * 4)
    if len(data) < header_len:
        return None
    if has_extension:
        if len(data) < header_len + 4:
            return None
        ext_words = int.from_bytes(data[header_len + 2 : header_len + 4], "big")
        header_len += 4 + (ext_words * 4)
        if len(data) < header_len:
            return None
    payload_end = len(data)
    if has_padding:
        pad_len = data[-1]
        if pad_len == 0 or pad_len > payload_end - header_len:
            return None
        payload_end -= pad_len
    return RtpPacket(
        marker=bool(data[1] & 0x80),
        payload_type=data[1] & 0x7F,
        sequence=int.from_bytes(data[2:4], "big"),
        timestamp=int.from_bytes(data[4:8], "big"),
        payload=data[header_len:payload_end],
    )


JPEG_ZIGZAG = (
    0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5,
    12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28,
    35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51,
    58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63,
)
JPEG_LUMA_QUANT = (
    16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55,
    14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62,
    18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92,
    49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99,
)
JPEG_CHROMA_QUANT = (
    17, 18, 24, 47, 99, 99, 99, 99, 18, 21, 26, 66, 99, 99, 99, 99,
    24, 26, 56, 99, 99, 99, 99, 99, 47, 66, 99, 99, 99, 99, 99, 99,
    99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99,
    99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99,
)
JPEG_DHT = bytes.fromhex(
    "ffc401a2"
    "0000010501010101010100000000000000000102030405060708090a0b"
    "100002010303020403050504040000017d010203000411051221314106"
    "13516107227114328191a1082342b1c11552d1f02433627282090a16"
    "1718191a25262728292a3435363738393a434445464748494a535455"
    "565758595a636465666768696a737475767778797a83848586878889"
    "8a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9"
    "bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7"
    "e8e9eaf1f2f3f4f5f6f7f8f9fa"
    "0100030101010101010101010000000000000102030405060708090a0b"
    "11000201020404030407050404000102770001020311040521310612"
    "41510761711322328108144291a1b1c109233352f0156272d10a16"
    "2434e125f11718191a262728292a35363738393a43444546474849"
    "4a535455565758595a636465666768696a737475767778797a828384"
    "85868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4"
    "b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae2e3"
    "e4e5e6e7e8e9eaf2f3f4f5f6f7f8f9fa"
)


class RtpJpegAssembler:
    def __init__(self, debug: bool = False) -> None:
        self.debug = debug
        self.jpeg_timestamp: int | None = None
        self.jpeg_chunks: dict[int, bytes] = {}
        self.jpeg_direct_parts: list[bytes] = []
        self.jpeg_expected_offset = 0
        self.jpeg_valid = True
        self.jpeg_last_sequence: int | None = None
        self.jpeg_info: dict[str, int | bytes | None] | None = None
        self.jpeg_drop_count = 0
        self.jpeg_frame_count = 0
        self.jpeg_last_drop_reason = ""

    def feed(self, packet: RtpPacket) -> bytes | None:
        payload = packet.payload
        if not payload:
            return None
        if self.jpeg_timestamp != packet.timestamp:
            if self.jpeg_timestamp is not None and (self.jpeg_chunks or self.jpeg_direct_parts):
                self._drop("timestamp_changed_before_marker")
            self._reset(packet.timestamp)
        if self.jpeg_last_sequence is not None and (
            (self.jpeg_last_sequence + 1) & 0xFFFF
        ) != packet.sequence:
            self.jpeg_valid = False
            self.jpeg_last_drop_reason = "sequence_gap"
        self.jpeg_last_sequence = packet.sequence

        if payload.startswith(b"\xff\xd8") or self.jpeg_direct_parts:
            self.jpeg_direct_parts.append(payload)
            if not packet.marker:
                return None
            data = b"".join(self.jpeg_direct_parts)
            valid = self.jpeg_valid and data.startswith(b"\xff\xd8")
            has_eoi = data.rstrip(b"\x00").endswith(b"\xff\xd9")
            self._reset((packet.timestamp + 1) & 0xFFFFFFFF)
            if not valid:
                self._drop("direct_jpeg_sequence_gap")
                return None
            if not has_eoi:
                self._drop("direct_jpeg_missing_eoi")
                return None
            self.jpeg_frame_count += 1
            return data

        info = self._parse_rtp_jpeg_payload(payload)
        if info is None:
            if packet.marker:
                self._drop("bad_rtp_jpeg_header", (packet.timestamp + 1) & 0xFFFFFFFF)
            return None

        offset = int(info["offset"])
        scan = info["scan"]
        if not isinstance(scan, bytes):
            if packet.marker:
                self._drop("bad_scan_payload", (packet.timestamp + 1) & 0xFFFFFFFF)
            return None
        if offset == 0:
            self.jpeg_info = info
        if offset != self.jpeg_expected_offset:
            self.jpeg_valid = False
            self.jpeg_last_drop_reason = "fragment_offset_gap"
        self.jpeg_chunks[offset] = scan
        self.jpeg_expected_offset = offset + len(scan)
        if not packet.marker:
            return None

        frame_info = self.jpeg_info or info
        chunks = self.jpeg_chunks
        valid = self.jpeg_valid
        self._reset((packet.timestamp + 1) & 0xFFFFFFFF)
        if not valid:
            self._drop(self.jpeg_last_drop_reason or "incomplete_frame")
            return None

        expected = 0
        parts: list[bytes] = []
        for chunk_offset in sorted(chunks):
            if chunk_offset != expected:
                self._drop("missing_fragment")
                return None
            chunk = chunks[chunk_offset]
            parts.append(chunk)
            expected += len(chunk)
        scan_data = b"".join(parts)
        if scan_data.startswith(b"\xff\xd8"):
            if not scan_data.rstrip(b"\x00").endswith(b"\xff\xd9"):
                self._drop("embedded_jpeg_missing_eoi")
                return None
            jpeg = scan_data
        else:
            restart_interval = self._restart_interval_for_scan(frame_info, scan_data)
            jpeg = self._jpeg_header(frame_info, restart_interval) + scan_data
        if not jpeg.endswith(b"\xff\xd9"):
            jpeg += b"\xff\xd9"
        self.jpeg_frame_count += 1
        return jpeg

    def _reset(self, timestamp: int) -> None:
        self.jpeg_timestamp = timestamp
        self.jpeg_chunks = {}
        self.jpeg_direct_parts = []
        self.jpeg_expected_offset = 0
        self.jpeg_valid = True
        self.jpeg_last_sequence = None
        self.jpeg_info = None

    def _drop(self, reason: str, next_timestamp: int | None = None) -> None:
        self.jpeg_drop_count += 1
        self.jpeg_last_drop_reason = reason
        if self.debug:
            print("[VIDEO DROP]", reason)
        if next_timestamp is not None:
            self._reset(next_timestamp)

    @staticmethod
    def _restart_marker_count(data: bytes) -> int:
        return sum(
            1
            for index in range(len(data) - 1)
            if data[index] == 0xFF and 0xD0 <= data[index + 1] <= 0xD7
        )

    def _restart_interval_for_scan(
        self,
        info: dict[str, int | bytes | None],
        scan_data: bytes,
    ) -> int:
        raw_interval = int(info.get("restart_interval") or 0)
        marker_count = self._restart_marker_count(scan_data)
        if marker_count <= 0:
            return raw_interval
        width = int(info["width"] or 640)
        height = int(info["height"] or 480)
        jpeg_type = int(info["type"] or 0) & 0x3F
        mcu_width, mcu_height = (16, 8) if jpeg_type == 0 else (16, 16)
        mcu_cols = max(1, (width + mcu_width - 1) // mcu_width)
        mcu_rows = max(1, (height + mcu_height - 1) // mcu_height)
        total_mcus = mcu_cols * mcu_rows
        intervals = marker_count + 1
        if intervals == mcu_rows:
            return mcu_cols
        if total_mcus % intervals == 0:
            return total_mcus // intervals
        return max(1, round(total_mcus / intervals))

    def _parse_rtp_jpeg_payload(self, payload: bytes) -> dict[str, int | bytes | None] | None:
        if len(payload) < 8:
            return None
        offset = (payload[1] << 16) | (payload[2] << 8) | payload[3]
        jpeg_type = payload[4]
        q = payload[5]
        width = max(1, payload[6]) * 8
        height = max(1, payload[7]) * 8
        pos = 8
        restart_interval = 0
        qtables: bytes | None = None
        if 64 <= jpeg_type <= 127:
            if len(payload) < pos + 4:
                return None
            restart_interval = int.from_bytes(payload[pos : pos + 2], "big")
            pos += 4
        if q >= 128 and offset == 0:
            if len(payload) < pos + 4:
                return None
            qtable_len = int.from_bytes(payload[pos + 2 : pos + 4], "big")
            if len(payload) < pos + 4 + qtable_len:
                return None
            qtables = payload[pos + 4 : pos + 4 + qtable_len]
            pos += 4 + qtable_len
        return {
            "offset": offset,
            "type": jpeg_type,
            "q": q,
            "width": width,
            "height": height,
            "restart_interval": restart_interval,
            "qtables": qtables,
            "scan": payload[pos:],
        }

    def _jpeg_header(
        self,
        info: dict[str, int | bytes | None],
        restart_interval: int | None = None,
    ) -> bytes:
        width = int(info["width"] or 640)
        height = int(info["height"] or 480)
        q = int(info["q"] or 75)
        qtables = info.get("qtables")
        if isinstance(qtables, bytes) and len(qtables) >= 128:
            luma = qtables[:64]
            chroma = qtables[64:128]
        else:
            quality = q if 1 <= q <= 99 else 75
            luma = self._scaled_quant_table(JPEG_LUMA_QUANT, quality)
            chroma = self._scaled_quant_table(JPEG_CHROMA_QUANT, quality)
        base_type = int(info["type"] or 0) & 0x3F
        y_sampling = 0x22 if base_type == 1 else 0x21
        if restart_interval is None:
            restart_interval = int(info.get("restart_interval") or 0)
        header = bytearray(b"\xff\xd8")
        header.extend(bytes.fromhex("ffe000104a46494600010100000100010000"))
        if restart_interval:
            header.extend(b"\xff\xdd")
            header.extend((4).to_bytes(2, "big"))
            header.extend(restart_interval.to_bytes(2, "big"))
        header.extend(self._dqt_segment(0, luma))
        header.extend(self._dqt_segment(1, chroma))
        header.extend(b"\xff\xc0")
        header.extend((17).to_bytes(2, "big"))
        header.append(8)
        header.extend(height.to_bytes(2, "big"))
        header.extend(width.to_bytes(2, "big"))
        header.extend(bytes([3, 1, y_sampling, 0, 2, 0x11, 1, 3, 0x11, 1]))
        header.extend(JPEG_DHT)
        header.extend(bytes.fromhex("ffda000c03010002110311003f00"))
        return bytes(header)

    @staticmethod
    def _scaled_quant_table(table: tuple[int, ...], quality: int) -> bytes:
        scale = 5000 // quality if quality < 50 else 200 - (quality * 2)
        return bytes(
            max(1, min(255, (table[zigzag_index] * scale + 50) // 100))
            for zigzag_index in JPEG_ZIGZAG
        )

    @staticmethod
    def _dqt_segment(table_id: int, table: bytes) -> bytes:
        return b"\xff\xdb" + (67).to_bytes(2, "big") + bytes([table_id]) + table[:64]


class DroneRuntime:
    def __init__(self, config: DroneConfig | None = None) -> None:
        self.config = config or DroneConfig()
        self.session: RtspUdpSession | None = None
        self.assembler = RtpJpegAssembler()
        self.lock = threading.RLock()
        self.frame_condition = threading.Condition(self.lock)
        self.latest_jpeg: bytes | None = None
        self.latest_frame_time = 0.0
        self.frame_id = 0
        self._keepalive_suppressed = False
        self._keepalive_thread: threading.Thread | None = None

    def ensure_started(self) -> None:
        with self.lock:
            if self.session is not None and self.session.running:
                return
            session = RtspUdpSession(
                host=self.config.host,
                port=self.config.port,
                url=self.config.url,
                client_port_base=self.config.client_port_base,
                verbose=self.config.verbose_rtsp,
            )
            session.add_rtp_callback(self._on_rtp_packet)
            session.connect()
            self.session = session
            self._send_neutral_warmup()
            self._start_keepalive()

    def _on_rtp_packet(self, data: bytes) -> None:
        packet = parse_rtp_packet(data)
        if packet is None:
            return
        session = self.session
        if (
            session is not None
            and session.video_payload_type is not None
            and packet.payload_type != session.video_payload_type
        ):
            return
        jpeg = self.assembler.feed(packet)
        if jpeg is None:
            return
        with self.frame_condition:
            self.latest_jpeg = jpeg
            self.latest_frame_time = time.time()
            self.frame_id += 1
            self.frame_condition.notify_all()

    def _base_state(self) -> HtjrPacketState:
        return HtjrPacketState(
            thr=clamp_byte(self.config.hover_throttle),
            speed=normalize_speed_byte(self.config.speed),
            altitude_hold=True,
            trim_ail=clamp_byte(self.config.trim_ail),
            trim_ele=clamp_byte(self.config.trim_ele),
            trim_rudd=clamp_byte(self.config.trim_rudd),
        )

    def neutral(self) -> HtjrPacketState:
        return self._base_state()

    def with_common(self, state: HtjrPacketState) -> HtjrPacketState:
        state.speed = normalize_speed_byte(self.config.speed)
        state.altitude_hold = True
        state.trim_ail = clamp_byte(self.config.trim_ail)
        state.trim_ele = clamp_byte(self.config.trim_ele)
        state.trim_rudd = clamp_byte(self.config.trim_rudd)
        if state.thr == 128:
            state.thr = clamp_byte(self.config.hover_throttle)
        return state

    def send_state(self, state: HtjrPacketState) -> None:
        self.ensure_started()
        session = self.session
        if session is None:
            raise RuntimeError("Drone session is not connected")
        self._keepalive_suppressed = True
        try:
            session.send_control(build_htjr_packet(self.with_common(state)))
        finally:
            self._keepalive_suppressed = False

    def send_for(self, state: HtjrPacketState, seconds: float, label: str = "") -> None:
        self.ensure_started()
        session = self.session
        if session is None:
            raise RuntimeError("Drone session is not connected")
        end = time.time() + max(0.0, seconds)
        if label:
            print(f"[DRONE] {label} for {seconds:.2f}s")
        self._keepalive_suppressed = True
        try:
            while time.time() < end:
                session.send_control(build_htjr_packet(self.with_common(state)))
                time.sleep(self.config.send_interval)
        finally:
            self._keepalive_suppressed = False

    def neutral_for(self, seconds: float, label: str = "") -> None:
        self.send_for(self.neutral(), seconds, label or "neutral")

    def emergency(self, seconds: float = 1.0) -> None:
        self.send_for(HtjrPacketState(emergency_down=True), seconds, "emergency")

    def _send_neutral_warmup(self) -> None:
        session = self.session
        if session is None:
            return
        packet = build_htjr_packet(self.neutral())
        for _ in range(5):
            session.send_control(packet)
            time.sleep(self.config.send_interval)

    def _start_keepalive(self) -> None:
        if self._keepalive_thread is not None and self._keepalive_thread.is_alive():
            return
        self._keepalive_thread = threading.Thread(
            target=self._keepalive_loop, daemon=True
        )
        self._keepalive_thread.start()

    def _keepalive_loop(self) -> None:
        """Continuously send neutral control packets to keep the drone stream alive.

        The HT-UFO firmware drops the RTSP/RTP video stream when it stops
        receiving control packets.  The old pygame scripts sent packets in a
        tight loop; this background thread replicates that behaviour so the
        FastAPI streaming endpoints keep working indefinitely.
        """
        while True:
            session = self.session
            if session is None or not session.running:
                break
            if not self._keepalive_suppressed:
                try:
                    packet = build_htjr_packet(self.neutral())
                    session.send_control(packet)
                except Exception:
                    break
            time.sleep(self.config.send_interval)

    def wait_for_frame(self, last_seen: int = 0, timeout: float = 5.0) -> tuple[int, bytes] | None:
        deadline = time.time() + timeout
        with self.frame_condition:
            while self.frame_id <= last_seen:
                if not self._is_running_locked():
                    return None
                remaining = deadline - time.time()
                if remaining <= 0:
                    return None
                self.frame_condition.wait(remaining)
            if self.latest_jpeg is None:
                return None
            return self.frame_id, self.latest_jpeg

    def capture_photo(self) -> DronePhoto:
        self.ensure_started()
        with self.frame_condition:
            jpeg = self.latest_jpeg
        if jpeg is None:
            raise RuntimeError("No decoded camera frame yet")
        capture_dir = Path(self.config.capture_dir)
        capture_dir.mkdir(parents=True, exist_ok=True)
        stamp = time.strftime("%Y%m%d-%H%M%S")
        path = capture_dir / f"htjr_{stamp}_{int(time.time() * 1000)}.jpg"
        with open(path, "wb") as file:
            file.write(jpeg)
        relative_path = path.resolve().relative_to(UPLOADS_DIR.resolve())
        file_path = relative_path.as_posix()
        return DronePhoto(file_path=file_path, url=f"/uploads/{file_path}")

    def close(self) -> None:
        with self.frame_condition:
            session = self.session
            self.session = None
            self.frame_condition.notify_all()
        if session is not None:
            session.close()

    def _is_running_locked(self) -> bool:
        return self.session is not None and self.session.running

    def is_running(self) -> bool:
        with self.lock:
            return self._is_running_locked()

    def status(self) -> dict[str, object]:
        with self.lock:
            return {
                "connected": self.session is not None and self.session.running,
                "frames": self.frame_id,
                "last_frame_age": None
                if not self.latest_frame_time
                else round(time.time() - self.latest_frame_time, 3),
                "jpeg_drops": self.assembler.jpeg_drop_count,
                "last_drop": self.assembler.jpeg_last_drop_reason,
                "config": self.config.__dict__,
            }


async def mjpeg_frame_generator(
    drone_runtime: DroneRuntime,
    is_disconnected: Callable[[], Awaitable[bool]] | None = None,
) -> AsyncIterator[bytes]:
    try:
        await asyncio.to_thread(drone_runtime.ensure_started)
        last_seen = 0
        boundary = b"--frame\r\n"
        while drone_runtime.is_running():
            if is_disconnected is not None and await is_disconnected():
                break
            item = await asyncio.to_thread(drone_runtime.wait_for_frame, last_seen, 0.5)
            if item is None:
                continue
            last_seen, jpeg = item
            yield (
                boundary
                + b"Content-Type: image/jpeg\r\n"
                + f"Content-Length: {len(jpeg)}\r\n\r\n".encode("ascii")
                + jpeg
                + b"\r\n"
            )
    except asyncio.CancelledError:
        return
