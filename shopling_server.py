"""
샵플링 이미지 업로드 로컬 서버
크롬 확장프로그램에서 편집된 이미지를 받아 샵플링에 자동 업로드합니다.

사용법:
  python shopling_server.py

필요 패키지:
  pip install flask selenium

환경:
  - Python 3.10+
  - Chrome 바탕화면 바로가기에 --remote-debugging-port=9222 설정 필요
  - 샵플링에 미리 로그인된 상태여야 합니다
"""

import os
import sys
import json
import base64
import time
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler

# 설정
PORT = 5000
DOWNLOAD_DIR = os.path.join(os.path.expanduser('~'), 'Downloads', 'shopling_images')
CHROME_DEBUG_PORT = 9222

# Selenium 사용 가능 여부
selenium_available = False
try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    selenium_available = True
except ImportError:
    print("[WARNING] selenium 미설치. 이미지 저장만 가능, 자동 업로드 불가.")
    print("         pip install selenium 으로 설치하세요.")


class ShoplingServer(BaseHTTPRequestHandler):
    driver = None
    driver_lock = threading.Lock()

    def _set_headers(self, code=200, content_type='application/json'):
        self.send_response(code)
        self.send_header('Content-Type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)

    def do_GET(self):
        if self.path == '/ping':
            self._set_headers(200)
            self.wfile.write(json.dumps({'status': 'ok', 'selenium': selenium_available}).encode())
        elif self.path == '/queue':
            queue_path = os.path.join(DOWNLOAD_DIR, 'upload_queue.json')
            if os.path.exists(queue_path):
                with open(queue_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                self._set_headers(200)
                self.wfile.write(json.dumps(data).encode())
            else:
                self._set_headers(200)
                self.wfile.write(json.dumps([]).encode())
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Not Found'}).encode())

    def do_POST(self):
        if self.path == '/upload':
            content_length = int(self.headers['Content-Length'])
            body = self.rfile.read(content_length)
            data = json.loads(body)

            prod_id = data.get('prodId')
            image_data_url = data.get('imageDataUrl')
            product_name = data.get('productName', '')

            if not prod_id or not image_data_url:
                self._set_headers(400)
                self.wfile.write(json.dumps({'error': 'prodId and imageDataUrl required'}).encode())
                return

            # 이미지 저장
            os.makedirs(DOWNLOAD_DIR, exist_ok=True)
            img_path = os.path.join(DOWNLOAD_DIR, f'prod_{prod_id}.jpg')

            try:
                header, encoded = image_data_url.split(',', 1)
                img_bytes = base64.b64decode(encoded)
                with open(img_path, 'wb') as f:
                    f.write(img_bytes)
                print(f"[SAVED] prod_{prod_id}.jpg ({len(img_bytes)} bytes) - {product_name}")
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({'error': f'Image save failed: {str(e)}'}).encode())
                return

            # upload_queue.json 업데이트
            queue_path = os.path.join(DOWNLOAD_DIR, 'upload_queue.json')
            queue = []
            if os.path.exists(queue_path):
                try:
                    with open(queue_path, 'r', encoding='utf-8') as f:
                        queue = json.load(f)
                except:
                    queue = []

            idx = next((i for i, q in enumerate(queue) if q.get('prodId') == prod_id), -1)
            entry = {'prodId': prod_id, 'filePath': img_path, 'productName': product_name, 'status': 'saved'}
            if idx >= 0:
                queue[idx] = entry
            else:
                queue.append(entry)

            with open(queue_path, 'w', encoding='utf-8') as f:
                json.dump(queue, f, ensure_ascii=False, indent=2)

            # Selenium 자동 업로드 시도
            upload_result = 'saved_only'
            if selenium_available:
                try:
                    upload_result = self.upload_to_shopling(prod_id, img_path)
                except Exception as e:
                    print(f"[UPLOAD ERROR] {prod_id}: {e}")
                    upload_result = f'upload_failed: {str(e)}'

            self._set_headers(200)
            self.wfile.write(json.dumps({
                'success': True,
                'prodId': prod_id,
                'filePath': img_path,
                'uploadResult': upload_result
            }).encode())
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Not Found'}).encode())

    def upload_to_shopling(self, prod_id, img_path):
        """Selenium을 통해 샵플링에 이미지 업로드"""
        with self.driver_lock:
            if ShoplingServer.driver is None:
                try:
                    options = Options()
                    options.add_experimental_option("debuggerAddress", f"127.0.0.1:{CHROME_DEBUG_PORT}")
                    ShoplingServer.driver = webdriver.Chrome(options=options)
                    print(f"[SELENIUM] Chrome 디버깅 모드 연결 성공 (port: {CHROME_DEBUG_PORT})")
                except Exception as e:
                    print(f"[SELENIUM] Chrome 연결 실패: {e}")
                    print(f"[TIP] Chrome을 --remote-debugging-port={CHROME_DEBUG_PORT} 옵션으로 실행하세요")
                    return f'chrome_connect_failed: {str(e)}'

            driver = ShoplingServer.driver

        try:
            # prodInfo 페이지로 이동
            url = f'https://a.shopling.co.kr/prod/prodInfo.phtml?mode=modify&opt_mode=modify&popup=Y&prod_id={prod_id}'
            driver.get(url)
            time.sleep(2)

            # 이미지 탭 클릭 (있는 경우)
            try:
                img_tab = WebDriverWait(driver, 5).until(
                    EC.element_to_be_clickable((By.XPATH, "//a[contains(text(),'이미지')]"))
                )
                img_tab.click()
                time.sleep(1)
            except:
                pass

            # file input 찾기 및 이미지 업로드
            file_inputs = driver.find_elements(By.CSS_SELECTOR, 'input[type="file"]')
            if file_inputs:
                abs_path = os.path.abspath(img_path)
                file_inputs[0].send_keys(abs_path)
                time.sleep(2)

                # 저장 버튼 클릭
                try:
                    save_btn = WebDriverWait(driver, 5).until(
                        EC.element_to_be_clickable((By.XPATH, "//button[contains(text(),'저장')] | //input[@value='저장']"))
                    )
                    save_btn.click()
                    time.sleep(2)
                    print(f"[UPLOAD OK] prod_{prod_id} 업로드 완료")
                    return 'uploaded'
                except:
                    print(f"[UPLOAD] prod_{prod_id} 파일 전송 완료 (저장 버튼 미확인)")
                    return 'file_sent'
            else:
                print(f"[UPLOAD] prod_{prod_id} file input을 찾을 수 없음")
                return 'no_file_input'

        except Exception as e:
            return f'upload_error: {str(e)}'

    def log_message(self, format, *args):
        # 로그 포맷 간소화
        print(f"[{self.log_date_time_string()}] {args[0]}")


def main():
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    server = HTTPServer(('localhost', PORT), ShoplingServer)

    print("=" * 50)
    print("  샵플링 이미지 업로드 서버")
    print("=" * 50)
    print(f"  서버 주소: http://localhost:{PORT}")
    print(f"  저장 폴더: {DOWNLOAD_DIR}")
    print(f"  Selenium:  {'사용 가능' if selenium_available else '미설치'}")
    print(f"  Chrome 디버그 포트: {CHROME_DEBUG_PORT}")
    print("=" * 50)
    print("  종료하려면 Ctrl+C 를 누르세요")
    print()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n서버를 종료합니다.")
        if ShoplingServer.driver:
            try:
                ShoplingServer.driver.quit()
            except:
                pass
        server.server_close()


if __name__ == '__main__':
    main()
