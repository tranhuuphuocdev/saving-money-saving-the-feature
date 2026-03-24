## SMSF - BE

# User (uId)
- uId (uuid)
- dn
- username
- password
- role
- createdAt
- updatedAt
- isDeleted

# Category (cateId)
- cateId (uuid)
- uId
- cateName
- cateType (income, expense)
- createdAt
- updatedAt
- isDefault
- isDeleted

# Transaction (txnId)
- txnId (uuid)
- uId
- wId
- cateId
- bId
- txnType (income, expense)
- amount
- note
- txnAt (real transtion create, use for report)
- createdAt
- updatedAt
- isDeleted

# Budget (bId)
- bId (uuid)
- uId
- cateId
- budName
- budAmount
- desc
- budType (week, month, year)
- periodMonth
- periodYear
- createdAt
- updatedAt

# Wallet (wId)
- wId (uuid)
- uId
- wName
- wType (bank, save, cash, momo)
- amount
- createdAt
- updatedAt

## Thêm tính năng
- Thông báo sử dụng tiền bằng bot tele
- Hủ tiền, khi nhập lương sẽ tự động phân tiền về các hủ
- Quản lý gói tiền hàng tháng (tiền nhà, tiền AI, tiền youtube premium,...)

docker run -d \
  --name smsf-be \
  --env-file .env \
  -p 3000:3000 \
  -e NODE_ENV=production \
  --network smsf-network \
  --platform linux/amd64 \
  tranhuuphuoc22/hthouse:smsf-be-1.0

sudo bash -c 'cat << EOF > /usr/local/bin/deploy-smsf-be
#!/bin/bash
echo "🚀 Bắt đầu quy trình Deploy smsf-be..."

# 1. Di chuyển vào thư mục chứa .env
cd /var/www/smsf-be || { echo "❌ Lỗi: Không tìm thấy thư mục /var/www/smsf-be"; exit 1; }

# 2. Kiểm tra file .env có tồn tại không
if [ ! -f .env ]; then
    echo "❌ Lỗi: File .env không tồn tại trong /var/www/smsf-be"
    exit 1
fi

# 3. Dọn dẹp container cũ nếu đang chạy (tránh trùng tên)
echo "Stop và xóa container cũ (nếu có)..."
docker rm -f smsf-be 2>/dev/null

# 4. Thực hiện lệnh Run
echo "Đang khởi chạy container mới..."
docker run -d \\
  --name smsf-be \\
  --env-file .env \\
  -p 3000:3000 \\
  -e NODE_ENV=production \\
  --network smsf-network \\
  --platform linux/amd64 \\
  tranhuuphuoc22/hthouse:smsf-be-1.0

if [ \$? -eq 0 ]; then
    echo "✅ Deploy smsf-be THÀNH CÔNG!"
else
    echo "❌ Lỗi: Không thể khởi chạy Docker."
    exit 1
fi
EOF'