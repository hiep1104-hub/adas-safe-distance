# -*- coding: utf-8 -*-
"""
Máy Chủ Di Động HTTPS ADAS SafeDistance Pro (Mobile Server)
Tự động sinh chứng chỉ SSL HTTPS (bắt buộc để điện thoại cấp quyền Camera sau & GPS),
phát hiện địa chỉ IP nội bộ và tạo mã QR để người dùng quét kết nối ngay bằng điện thoại.
"""
import os
import sys
import socket
import ssl
from http.server import HTTPServer, SimpleHTTPRequestHandler
import datetime

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

try:
    import qrcode
except ImportError:
    qrcode = None


def get_local_ip():
    """Lấy địa chỉ IPv4 của máy tính trong mạng Wi-Fi/LAN"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Kết nối tạm để lấy IP card mạng chính
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip


def generate_self_signed_cert(cert_dir="certs", ip="127.0.0.1"):
    """Tự động tạo cặp chứng chỉ SSL self-signed (cert.pem & key.pem)"""
    os.makedirs(cert_dir, exist_ok=True)
    cert_path = os.path.join(cert_dir, "cert.pem")
    key_path = os.path.join(cert_dir, "key.pem")

    if os.path.exists(cert_path) and os.path.exists(key_path):
        return cert_path, key_path

    print("[SSL] Đang tạo chứng chỉ bảo mật HTTPS cho điện thoại...")
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
    return cert_path, key_path


class AdasHttpHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="mobile_app", **kwargs)

    def end_headers(self):
        # Thêm header cho phép PWA và Service Worker
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()


def run_server(port=8443):
    local_ip = get_local_ip()
    cert_path, key_path = generate_self_signed_cert(ip=local_ip)

    server_address = ('0.0.0.0', port)
    httpd = HTTPServer(server_address, AdasHttpHandler)

    # Cấu hình SSL Context
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ssl_context.load_cert_chain(certfile=cert_path, keyfile=key_path)
    httpd.socket = ssl_context.wrap_socket(httpd.socket, server_side=True)

    url = f"https://{local_ip}:{port}"

    print("\n" + "=" * 65)
    print("   ADAS SAFEDISTANCE PRO — MÁY CHỦ DI ĐỘNG KHI CHẠY XE THỰC TẾ")
    print("=" * 65)
    print(f"\n📱 Địa chỉ truy cập trên điện thoại:\n   👉 {url}\n")

    # In mã QR ra terminal và lưu ảnh QR
    if qrcode is not None:
        qr = qrcode.QRCode(border=1)
        qr.add_data(url)
        qr.make(fit=True)
        print("📲 QUÉT MÃ QR BẰNG CAMERA ĐIỆN THOẠI ĐỂ MỞ ỨNG DỤNG NGAY:\n")
        qr.print_ascii(invert=True)
        img = qr.make_image(fill_color="black", back_color="white")
        img.save("qr_code_mobile.png")
        print("\n(Đã lưu ảnh mã QR tại: qr_code_mobile.png)")

    print("\n💡 HƯỚNG DẪN KHI MỞ TRÊN ĐIỆN THOẠI:")
    print("1. Đảm bảo điện thoại và máy tính cùng kết nối mạng Wi-Fi (hoặc phát 4G Hotspot từ điện thoại sang máy tính).")
    print("2. Mở trình duyệt Safari (iPhone) hoặc Chrome (Android) truy cập link trên hoặc quét mã QR.")
    print("3. Nếu trình duyệt hiện 'Cảnh báo chứng chỉ bảo mật', bấm 'Nâng cao / Advanced' -> 'Tiếp tục truy cập (Proceed)' (do đây là chứng chỉ SSL nội bộ tự tạo).")
    print("4. Cho phép quyền Camera & Vị trí (GPS) để app tự động kích hoạt.")
    print("5. Bấm vào nút chia sẻ của trình duyệt chọn 'Thêm vào Màn hình chính' (Add to Home Screen) để dùng như App độc lập toàn màn hình!")
    print("\nĐang lắng nghe kết nối... Nhấn Ctrl+C để dừng server.")
    print("-" * 65)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nĐã dừng máy chủ di động.")
        httpd.server_close()


if __name__ == "__main__":
    run_server()
