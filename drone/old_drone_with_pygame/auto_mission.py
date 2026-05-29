#!/usr/bin/env python3
"""
Tiny automated mission for the HTJR drone.

Connect to the drone Wi-Fi first. This reuses fixed_drone.py's working RTSP,
control packet, stream, trim, and photo capture code.
"""

from __future__ import annotations

import argparse
import time

from fixed_drone import (
    DEFAULT_DRONE_IP,
    DEFAULT_RTSP_PORT,
    DEFAULT_RTSP_URL,
    DroneController,
    HtjrPacketState,
    RtspUdpSession,
    RtpVideoViewer,
    build_htjr_packet,
    clamp_byte,
    normalize_speed_byte,
)


def send_for(
    controller: DroneController,
    state: HtjrPacketState,
    seconds: float,
    interval: float,
    label: str,
) -> None:
    end = time.time() + seconds
    print(f"[MISSION] {label} for {seconds:.2f}s")
    while time.time() < end:
        controller.send_state(state)
        time.sleep(interval)


def neutral_for(
    controller: DroneController,
    seconds: float,
    interval: float,
    label: str = "neutral",
) -> None:
    send_for(controller, controller.neutral(), seconds, interval, label)


def run_mission(
    controller: DroneController,
    viewer: RtpVideoViewer | None,
    interval: float,
    countdown: float,
) -> None:
    print("[MISSION] sequence: T -> wait -> S -> Left -> Right -> photo -> Down -> Q emergency")
    if countdown > 0:
        neutral_for(controller, countdown, interval, "countdown / step back")

    send_for(controller, HtjrPacketState(flyup=True), 0.06, interval, "T launch/up pulse")
    neutral_for(controller, 2.0, interval, "wait after launch")

    send_for(
        controller,
        HtjrPacketState(ele=128 - controller.axis_delta),
        0.30,
        interval,
        "S / back",
    )
    neutral_for(controller, 0.30, interval)

    send_for(
        controller,
        HtjrPacketState(rudd=128 - controller.axis_delta),
        0.30,
        interval,
        "Left arrow / yaw left",
    )
    neutral_for(controller, 0.50, interval)

    send_for(
        controller,
        HtjrPacketState(rudd=128 + controller.axis_delta),
        0.50,
        interval,
        "Right arrow / yaw right",
    )
    neutral_for(controller, 0.60, interval, "settle before photo")

    print("[MISSION] Space / capture photo")
    if viewer is None:
        print("[PHOTO] video is off; no frame to capture")
    else:
        viewer.capture_picture()

    send_for(controller, HtjrPacketState(flydown=True), 3.0, interval, "Down / descend")
    send_for(controller, HtjrPacketState(emergency_down=True), 1.0, interval, "Q / emergency down")
    neutral_for(controller, 0.30, interval, "final neutral")
    print("[MISSION] complete")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default=DEFAULT_DRONE_IP)
    parser.add_argument("--port", type=int, default=DEFAULT_RTSP_PORT)
    parser.add_argument("--url", default=DEFAULT_RTSP_URL)
    parser.add_argument("--client-port", type=int, default=None)
    parser.add_argument("--speed", type=int, default=30)
    parser.add_argument("--axis-delta", type=int, default=90)
    parser.add_argument("--hover-throttle", type=int, default=128)
    parser.add_argument("--trim-ail", type=int, default=164)
    parser.add_argument("--trim-ele", type=int, default=128)
    parser.add_argument("--trim-rudd", type=int, default=128)
    parser.add_argument("--send-interval", type=float, default=0.04)
    parser.add_argument("--countdown", type=float, default=3.0)
    parser.add_argument("--capture-dir", default="captures")
    parser.add_argument("--no-video", action="store_true")
    parser.add_argument("--verbose-rtsp", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    speed = normalize_speed_byte(args.speed)

    print("Connect this computer to the drone Wi-Fi first.")
    print("[INFO] RTSP URL:", args.url)
    print("[INFO] Packet speed:", speed)
    print("[INFO] Axis delta:", args.axis_delta)
    print("[INFO] Hover throttle:", clamp_byte(args.hover_throttle))
    print("[INFO] Trim AIL/ELE/RUDD:", args.trim_ail, args.trim_ele, args.trim_rudd)
    print("[INFO] Video:", "off" if args.no_video else "on")
    if not args.no_video:
        print("[INFO] Capture dir:", args.capture_dir)

    session = RtspUdpSession(
        host=args.host,
        port=args.port,
        url=args.url,
        client_port_base=args.client_port,
        verbose=args.verbose_rtsp,
    )
    viewer: RtpVideoViewer | None = None
    if not args.no_video:
        viewer = RtpVideoViewer(session, capture_dir=args.capture_dir)
        session.add_rtp_callback(viewer.on_rtp_packet)

    controller = DroneController(
        session,
        speed=speed,
        axis_delta=args.axis_delta,
        altitude_hold=True,
        hover_throttle=args.hover_throttle,
        trim_ail=args.trim_ail,
        trim_ele=args.trim_ele,
        trim_rudd=args.trim_rudd,
    )

    try:
        session.connect()
        if viewer is not None:
            viewer.start()

        neutral = build_htjr_packet(controller.neutral())
        for _ in range(5):
            session.send_control(neutral)
            time.sleep(args.send_interval)

        run_mission(controller, viewer, args.send_interval, args.countdown)
    finally:
        print("[INFO] closing")
        try:
            neutral = build_htjr_packet(controller.neutral())
            for _ in range(5):
                session.send_control(neutral)
                time.sleep(args.send_interval)
        except Exception:
            pass
        if viewer is not None:
            viewer.stop()
        session.close()


if __name__ == "__main__":
    main()
