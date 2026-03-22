git checkout package.json

source script/docker/init-images.sh

DOCKER_FILE=Dockerfile-base

IMAGE_NAME=hthouse

IMAGE_TAG=client-base-1.0

DOCKER_HUB=tranhuuphuoc22

source script/docker/build-images.sh
source script/docker/upload-images.sh
