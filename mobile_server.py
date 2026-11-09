# -*- coding: utf-8 -*-
"""
Máy Chủ Di Động HTTPS ADAS SafeDistance Pro (Mobile Server)
Tự động sinh chứng chỉ SSL HTTPS (bắt buộc để điện thoại cấp quyền Camera sau & GPS),
phát hiện địa chỉ IP nội bộ và tạo mã QR để người dùng quét kết nối ngay bằng điện thoại.
Đồng bộ hóa 1 thể thống nhất với GitHub Pages Online.
"""
import os
import sys
import socket
import ssl
import shutil
from http.server import HTTPServer, SimpleHTTPRequestHandler
import datetime
import webbrowser

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

try:
    import qrcode
except ImportError:
    qrcode = None


ONLINE_APP_URL = "https://hiep1104-hub.github.io/adas-safe-distance/"


def get_local_ip():
    """Lấy địa chỉ IPv4 của máy tính trong mạng Wi-Fi/LAN"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip


def sync_web_assets(base_dir):
    """Đảm bảo thư mục gốc và mobile_app luôn đồng bộ 1 thể thống nhất"""
    mobile_dir = os.path.join(base_dir, "mobile_app")
    os.makedirs(mobile_dir, exist_ok=True)
    sync_files = ["index.html", "app.js", "style.css", "manifest.json", "sw.js", "icon-192.png"]
    for f in sync_files:
        src = os.path.join(base_dir, f)
        dst = os.path.join(mobile_dir, f)
        if os.path.exists(src):
            try:
                shutil.copy2(src, dst)
            except Exception:
                pass


def generate_self_signed_cert(cert_dir="certs", ip="127.0.0.1"):
    """Tự động tạo cặp chứng chỉ SSL self-signed (cert.pem & key.pem)"""
    os.makedirs(cert_dir, exist_ok=True)
    cert_path = os.path.join(cert_dir, "cert.pem")
    key_path = os.path.join(cert_dir, "key.pem")

    if os.path.exists(cert_path) and os.path.exists(key_path):
        return cert_path, key_path

    print("[SSL] Đang tạo chứng chỉ bảo mật HTTPS cho điện thoại...")
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        import ipaddress

        key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )

        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COMMON_NAME, ip),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "ADAS SafeDistance"),
        ])

        san_list = [
            x509.DNSName("localhost"),
            x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
        ]
        try:
            san_list.append(x509.IPAddress(ipaddress.IPv4Address(ip)))
        except Exception:
            pass

        cert = x509.CertificateBuilder().subject_name(
            subject
        ).issuer_name(
            issuer
        ).public_key(
            key.public_key()
        ).serial_number(
            x509.random_serial_number()
        ).not_valid_before(
            datetime.datetime.utcnow() - datetime.timedelta(days=1)
        ).not_valid_after(
            datetime.datetime.utcnow() + datetime.timedelta(days=365)
        ).add_extension(
            x509.SubjectAlternativeName(san_list),
            critical=False,
        ).sign(key, hashes.SHA256())

        with open(key_path, "wb") as f:
            f.write(key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption(),
            ))

        with open(cert_path, "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))

        print(f"[SSL] Đã tạo thành công: {cert_path} & {key_path}")
    except Exception as e:
        print(f"[SSL] Cảnh báo sinh cert: {e}")

    return cert_path, key_path


class AdasUnifiedHttpHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        super().__init__(*args, directory=base_dir, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()


def run_server(port=8443, open_browser=False):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    sync_web_assets(base_dir)

    local_ip = get_local_ip()
    cert_path, key_path = generate_self_signed_cert(ip=local_ip)

    server_address = ('0.0.0.0', port)
    httpd = HTTPServer(server_address, AdasUnifiedHttpHandler)

    if os.path.exists(cert_path) and os.path.exists(key_path):
        ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ssl_context.load_cert_chain(certfile=cert_path, keyfile=key_path)
        httpd.socket = ssl_context.wrap_socket(httpd.socket, server_side=True)
        url = f"https://{local_ip}:{port}"
    else:
        url = f"http://{local_ip}:{port}"

    print("\n" + "=" * 70)
    print("   ADAS SAFEDISTANCE PRO — MÁY CHỦ DI ĐỘNG KẾT NỐI ĐIỆN THOẠI")
    print("   Căn cứ: TT 38/2024/TT-BGTVT • NĐ 168/2024/NĐ-CP • QCVN 41:2019")
    print("=" * 70)
    print(f"\n📱 1. Link Mạng Nội Bộ (Wi-Fi/Hotspot):\n   👉 {url}\n")
    print(f"🌐 2. Link Online Trực Tuyến Toàn Cầu (Khuyên Dùng Trên Đường):\n   👉 {ONLINE_APP_URL}\n")

    if qrcode is not None:
        try:
            qr = qrcode.QRCode(border=1)
            qr.add_data(ONLINE_APP_URL)
            qr.make(fit=True)
            print("📲 QUÉT MÃ QR BẰNG CAMERA ĐIỆN THOẠI ĐỂ MỞ NGAY (ONLINE KHÔNG CẦN CÀI ĐẶT):\n")
            qr.print_ascii(invert=True)
            img = qr.make_image(fill_color="black", back_color="white")
            img.save(os.path.join(base_dir, "qr_code_online.png"))
        except Exception:
            pass

    if open_browser:
        try:
            webbrowser.open(ONLINE_APP_URL)
        except Exception:
            pass

    print("\n💡 HƯỚNG DẪN KHI LÁI XE:")
    print("1. Điện thoại mở trực tiếp link Online hoặc quét mã QR ở trên.")
    print("2. Cấp quyền Camera & Vị trí (GPS) để hệ thống tự động cảnh báo.")
    print("3. Gắn điện thoại lên giá đỡ trên kính lái hoặc taplo và lái xe an toàn.")
    print("\nĐang chạy máy chủ... Nhấn Ctrl+C để dừng.")
    print("-" * 70)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nĐã dừng máy chủ di động.")
        httpd.server_close()


if __name__ == "__main__":
    run_server()
