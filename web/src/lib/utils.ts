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
