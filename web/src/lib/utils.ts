import { ModelsRecognizedSkuDetection } from "@/api-client";
import { SkuDetectionExtra } from "@/components/image-with-boxes";
import { Badge } from "@/components/ui/badge";
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type StatusColors = 'GREEN' | 'YELLOW' | 'RED'
export const styleByColor = (color: StatusColors) => {

  const res = (
    {
      GREEN: [
        'secondary',
        'bg-green-500 text-white dark:bg-green-600',
      ],
      YELLOW: [
        'secondary',
        'bg-yellow-500 text-white dark:bg-yellow-600',
      ],
      RED: ['destructive', ''],
    } satisfies Record<
      typeof color,
      [Parameters<typeof Badge>[0]['variant'], string]
    >
  )[color] ?? ['default', ''];

  return res;

}

export const LOCAL_STORAGE_DEFAULT_THRESHOLD = "settings-default-threshold"
export const getDefaultThreshold = () => {
  return Number(localStorage.getItem(LOCAL_STORAGE_DEFAULT_THRESHOLD) ?? "0.75")
}

export const LOCAL_STORAGE_ONE_THRESHOLD = "settings-one-threshold"

export const getOneThreshold = () => {
  return Number(localStorage.getItem(LOCAL_STORAGE_ONE_THRESHOLD) ?? "0.8")
}

export const LOCAL_STORAGE_ONE_OTHER_THRESHOLD = "settings-one-other-threshold"
export const getOneOtherThreshold = () => {
  return Number(localStorage.getItem(LOCAL_STORAGE_ONE_OTHER_THRESHOLD) ?? "0.8")
}

export function downloadTextFile(filename: string, text: string) {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

export function downloadImage(filename: string, url: string) {
  fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      return response.blob();
    })
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    })
    .catch(error => {
      console.error('Error downloading image:', error);
    });
}

export const filterDetects = (detects: (SkuDetectionExtra | ModelsRecognizedSkuDetection)[]): SkuDetectionExtra[] => {
  return detects.filter(x => {
    return x.confidence >= getDefaultThreshold();
  })
}

export type ImageDimensions = {
  naturalWidth: number,
  naturalHeight: number,
  displayWidth: number,
  displayHeight: number,
  xOffset: number,
  yOffset: number,
}
export const getCenterDistance = (rect: ModelsRecognizedSkuDetection, imageDimensions: ImageDimensions) => {
  const x = rect.rect.x + rect.rect.w / 2;
  const y = rect.rect.y + rect.rect.h / 2;

  const cx = imageDimensions.naturalWidth / 2;
  const cy = imageDimensions.naturalHeight / 2;

  return Math.sqrt(Math.pow(cx - x, 2) + Math.pow(cy - y, 2));
};

export const filterOneDetects = (detectsOriginal: (SkuDetectionExtra | ModelsRecognizedSkuDetection)[], imageDimensions: ImageDimensions): SkuDetectionExtra[] => {
  const detects: ModelsRecognizedSkuDetection[] = JSON.parse(JSON.stringify(detectsOriginal));

  let res: SkuDetectionExtra[] = []
  const filtered = detects.filter(
    x => x.confidence >= getDefaultThreshold()
  );
  const sorted = filtered
    .sort((a, b) => {
      return getCenterDistance(a, imageDimensions) - getCenterDistance(b, imageDimensions);
    })
    .slice(0, 1);

  res = sorted;
  if (res.length === 0) {
    const sortedConfidence = detects.sort(
      (a, b) => b.confidence - a.confidence
    );

    const winner = sortedConfidence.shift();
    if (winner && winner.confidence > getDefaultThreshold() * getOneThreshold()) {
      if (
        sortedConfidence.every(
          x => x.confidence < winner.confidence * getOneOtherThreshold()
        )
      ) {
        winner;
        (winner as SkuDetectionExtra).msg =
          'Система не уверена, но возможно это: ';
        res = [winner];
      }
    }
  }

  return res;
}