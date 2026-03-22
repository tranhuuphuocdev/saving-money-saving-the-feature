docker run -d \
  --name smsf-fe \
  --env-file .env \
  -p 3033:3033 \
  -e NODE_ENV=production \
  -e NEXT_PUBLIC_API_BASE_URL=http://160.250.181.32/:3000/api/v1 \
  --network smsf-network \
  --platform linux/amd64 \
  tranhuuphuoc22/hthouse:smsf-fe-1.0
