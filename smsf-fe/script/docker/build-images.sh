echo "Build ${DOCKER_FILE} -> ${IMAGE_NAME}:${IMAGE_TAG} and ${IMAGE_NAME}:${IMAGE_TAG_LATEST}."

docker build -f ${DOCKER_FILE} \
    --platform=linux/amd64 \
    -t ${IMAGE_NAME}:${IMAGE_TAG} \
    -t ${IMAGE_NAME}:${IMAGE_TAG_LATEST} \
    --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID="${NEXT_PUBLIC_GOOGLE_CLIENT_ID}" \
    . \
    # --no-cache \
