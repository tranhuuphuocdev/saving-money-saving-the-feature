import { Area } from 'react-easy-crop';

const OUTPUT_SIZE = 512;

async function loadImage(imageSrc: string): Promise<HTMLImageElement> {
    const image = new Image();
    image.src = imageSrc;

    await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Không thể đọc ảnh đã chọn.'));
    });

    return image;
}

export async function cropAvatarImage(imageSrc: string, cropAreaPixels: Area): Promise<File> {
    const image = await loadImage(imageSrc);
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;

    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('Không thể xử lý ảnh trên thiết bị này.');
    }

    context.imageSmoothingQuality = 'high';
    context.drawImage(
        image,
        cropAreaPixels.x,
        cropAreaPixels.y,
        cropAreaPixels.width,
        cropAreaPixels.height,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE,
    );

    const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((nextBlob) => resolve(nextBlob), 'image/webp', 0.92);
    });

    if (!blob) {
        throw new Error('Xuất ảnh thất bại.');
    }

    return new File([blob], `avatar-${Date.now()}.webp`, { type: 'image/webp' });
}