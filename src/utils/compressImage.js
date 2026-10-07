export function compressImage(file, { maxBytes = 200 * 1024, maxDimension = 512, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The image could not be read.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('The image could not be decoded.'));
      image.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        let currentQuality = quality;
        let dataUrl = canvas.toDataURL('image/webp', currentQuality);
        while (dataUrl.length * 0.75 > maxBytes && currentQuality > 0.45) {
          currentQuality -= 0.08;
          dataUrl = canvas.toDataURL('image/webp', currentQuality);
        }
        URL.revokeObjectURL(image.src);
        if (dataUrl.length * 0.75 > maxBytes) return reject(new Error('The image is still larger than 200 KB. Choose a simpler logo.'));
        resolve(dataUrl);
      };
      image.src = URL.createObjectURL(file);
    };
    reader.readAsDataURL(file);
  });
}
