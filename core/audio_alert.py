# -*- coding: utf-8 -*-
"""
Hệ thống Phát Tín hiệu Cảnh báo Âm thanh & Giọng nói Đa luồng (Non-blocking Audio Alert)
Hỗ trợ tiếng bíp theo tần số nguy hiểm (winsound) và giọng nói cảnh báo (Windows SAPI).
"""
import time
import threading
import queue
from typing import Optional
from core.legal_rules import AlertLevel

try:
    import winsound
except ImportError:
    winsound = None

try:
    import win32com.client
except ImportError:
    win32com = None


class AudioAlertManager:
    def __init__(self):
        self.enabled = True
        self.voice_enabled = True
        self.current_alert_level: AlertLevel = AlertLevel.SAFE
        self.last_voice_time = 0.0
        self.voice_cooldown_sec = 4.0  # Khoảng cách tối thiểu giữa 2 lần đọc giọng nói để tránh nói dồn dập
        self._running = True
        self._lock = threading.Lock()

        # Thread phát tiếng bíp tuần hoàn
        self._beep_thread = threading.Thread(target=self._beep_worker, daemon=True)
        self._beep_thread.start()

        # Queue và thread phát giọng nói
        self._speech_queue = queue.Queue(maxsize=3)
        self._speech_thread = threading.Thread(target=self._speech_worker, daemon=True)
        self._speech_thread.start()

    def set_alert_level(self, level: AlertLevel, actual_dist: float, legal_dist: float):
        """
        Cập nhật mức cảnh báo hiện tại từ bộ xử lý khoảng cách
        """
        with self._lock:
            self.current_alert_level = level

        now = time.time()
        if self.enabled and self.voice_enabled and (now - self.last_voice_time >= self.voice_cooldown_sec):
            if level == AlertLevel.CRITICAL:
                self.last_voice_time = now
                self._enqueue_speech("Cảnh báo nguy hiểm! Giảm tốc độ ngay!")
            elif level == AlertLevel.WARNING:
                self.last_voice_time = now
                self._enqueue_speech("Chú ý! Bám sát xe trước dưới mức an toàn!")

    def _enqueue_speech(self, message: str):
        try:
            self._speech_queue.put_nowait(message)
        except queue.Full:
            pass

    def _beep_worker(self):
        """
        Luồng nền phát chuông cảnh báo
        """
        while self._running:
            if not self.enabled or winsound is None:
                time.sleep(0.1)
                continue

            with self._lock:
                level = self.current_alert_level

            if level == AlertLevel.CRITICAL:
                # Nguy hiểm khẩn cấp: Bíp cao độ 1800Hz, dồn dập
                try:
                    winsound.Beep(1800, 150)
                except Exception:
                    pass
                time.sleep(0.12)
            elif level == AlertLevel.WARNING:
                # Cảnh báo chú ý: Bíp vừa 1000Hz, ngắt quãng vừa phải
                try:
                    winsound.Beep(1000, 200)
                except Exception:
                    pass
                time.sleep(0.65)
            else:
                # An toàn: Nghỉ ngơi
                time.sleep(0.15)

    def _speech_worker(self):
        """
        Luồng nền phát giọng nói bằng Microsoft SAPI
        """
        sapi_voice = None
        if win32com is not None:
            try:
                # Cần khởi tạo COM trong từng luồng
                import pythoncom
                pythoncom.CoInitialize()
                sapi_voice = win32com.client.Dispatch("SAPI.SpVoice")
                sapi_voice.Rate = 1  # Tốc độ đọc
                sapi_voice.Volume = 95
            except Exception as e:
                sapi_voice = None

        while self._running:
            try:
                msg = self._speech_queue.get(timeout=0.3)
                if self.enabled and self.voice_enabled and sapi_voice is not None:
                    try:
                        sapi_voice.Speak(msg)
                    except Exception:
                        pass
                self._speech_queue.task_done()
            except queue.Empty:
                continue

    def set_mute(self, is_muted: bool):
        self.enabled = not is_muted

    def set_voice_enabled(self, is_voice_on: bool):
        self.voice_enabled = is_voice_on

    def stop(self):
        self._running = False
