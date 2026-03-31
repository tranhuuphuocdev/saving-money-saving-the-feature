git checkout package.json

source script/docker/init-images.sh

DOCKER_FILE=Dockerfile

IMAGE_NAME=hthouse

IMAGE_TAG=smsf-fe-1.0

DOCKER_HUB=tranhuuphuoc22

if [ -f .env ]; then
    echo "Found .env file, passing to build process..."
fi

source script/docker/build-images.sh
source script/docker/upload-images.sh