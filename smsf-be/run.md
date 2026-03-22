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