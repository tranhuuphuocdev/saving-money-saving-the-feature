docker run -d \
  --name smsf-fe \
  --env-file .env \
  -p 3033:3033 \
  -e NODE_ENV=production \
  -e NEXT_PUBLIC_API_BASE_URL=http://160.250.181.32/:3000/api/v1 \
  --network smsf-network \
  --platform linux/amd64 \
  tranhuuphuoc22/hthouse:smsf-fe-1.0

sudo bash -c 'cat << EOF > /usr/local/bin/deploy-smsf-fe
#!/bin/bash
echo "🕒 Thời gian thực thi: \$(date "+%H:%M:%S %d/%m/%Y")"
echo "🚀 Bắt đầu quy trình Deploy smsf-fe..."

# 1. Di chuyển vào thư mục chứa .env (Giả sử cùng thư mục cha với BE)
cd /var/www/smsf-fe || { echo "❌ Lỗi: Không tìm thấy thư mục /var/www/smsf-fe"; exit 1; }

# 2. Kiểm tra file .env
if [ ! -f .env ]; then
    echo "❌ Lỗi: File .env không tồn tại trong /var/www/smsf-fe"
    exit 1
fi

# 3. Dọn dẹp container cũ
echo "Dừng và xóa container smsf-fe cũ..."
docker rm -f smsf-fe 2>/dev/null

# 4. Pull image mới nhất
echo "Đang kéo image FE mới nhất..."
docker pull tranhuuphuoc22/hthouse:smsf-fe-1.0

# 5. Thực hiện lệnh Run
echo "Đang khởi chạy container FE mới..."
docker run -d \\
  --name smsf-fe \\
  --env-file .env \\
  -p 3033:3033 \\
  -e NODE_ENV=production \\
  -e NEXT_PUBLIC_API_BASE_URL=http://160.250.181.32:3000/api/v1 \\
  --network smsf-network \\
  --platform linux/amd64 \\
  tranhuuphuoc22/hthouse:smsf-fe-1.0

# 6. Kiểm tra kết quả
if [ \$? -eq 0 ]; then
    echo "------------------------------------------"
    echo "✅ Deploy smsf-fe THÀNH CÔNG!"
    echo "🔗 URL: http://160.250.181.32:3033"
else
    echo "❌ Lỗi: Không thể khởi chạy Docker FE."
    exit 1
fi
EOF'
