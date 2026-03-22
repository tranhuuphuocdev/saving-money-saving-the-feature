echo "Run init-images.sh"

APP_VERSION=$(jq -r '.version' package.json)
DATE=$(date +'%Y%m%d%H%M')
NEW_VERSION=${APP_VERSION}-${DATE}
GIT_COMMIT_ID=$(git log -1 --pretty=format:'%h')

jq --arg v "$NEW_VERSION" '.version = $v' package.json > tmp.json && mv tmp.json package.json

IMAGE_TAG=${APP_VERSION}-${DATE}-${GIT_COMMIT_ID}
IMAGE_TAG_LATEST=${APP_VERSION}-latest

mkdir -p build
cat > build/version.json <<EOF
{
	"version": "${NEW_VERSION}",
	"appVersion": "${APP_VERSION}",
	"imageTag": "${IMAGE_TAG}",
	"imageTagLatest": "${IMAGE_TAG_LATEST}",
	"gitCommit": "${GIT_COMMIT_ID}",
	"buildDate": "${DATE}"
}
EOF
