import { AuditLogResponse, ModelsRecognizedSkuDetection } from "@/api-client"

// Action display names
export const actionLabels: Record<string, string> = {
  user_created: "Пользователь создан",
  user_deleted: "Пользователь удален",
  user_updated: "Пользователь обновлен",
  user_blocked: "Пользователь заблокирован",
  user_unblocked: "Пользователь разблокирован",

  password_reset: "Сброс пароля",
  password_changed: "Пароль изменен",
  user_login: "Вход пользователя",
  user_logout: "Выход пользователя",

  recognition_request_success: "Запрос распознавания - Успешно",
  recognition_request_fail: "Запрос распознавания - Ошибка",

  recognition_user_detect_request_success: "Запрос распознавания пользователя - Успешно",
  recognition_user_detect_request_fail: "Запрос распознавания пользователя - Ошибка",
  recognition_user_recognize_sku_request_success: "Запрос поиска объекта пользователя - Успешно",
  recognition_user_recognize_sku_request_fail: "Запрос поиска объекта пользователя - Ошибка"
}

// Action color mapping
export const actionColors: Record<string, string> = {
  user_created: "bg-green-100 text-green-800",
  user_deleted: "bg-red-100 text-red-800",
  user_updated: "bg-blue-100 text-blue-800",
  user_blocked: "bg-red-100 text-red-800",
  user_unblocked: "bg-yellow-100 text-yellow-800",

  password_reset: "bg-orange-100 text-orange-800",
  password_changed: "bg-purple-100 text-purple-800",
  user_login: "bg-green-100 text-green-800",
  user_logout: "bg-gray-100 text-gray-800",

  recognition_request_success: "bg-green-100 text-green-800",
  recognition_request_fail: "bg-red-100 text-red-800",

  recognition_user_detect_request_success: "bg-green-100 text-green-800",
  recognition_user_detect_request_fail: "bg-red-100 text-red-800",
  recognition_user_recognize_sku_request_success: "bg-green-100 text-green-800",
  recognition_user_recognize_sku_request_fail: "bg-red-100 text-red-800",
}
export const entityTypeLabels: Record<string, string> = {
  user: "Пользователь",
  system: "Система",
  recognition: "Распознавание",
}

export const extractRectsFromLog = (log: AuditLogResponse) => {
  const parsed = JSON.parse(log.details ?? '{}')
  const detections = (parsed.response?.detections || parsed.response?.rects);
  console.log(detections)
  let res: ModelsRecognizedSkuDetection[] = []

  if (detections instanceof Array) {
    res = detections.map(x => {
      const rect = x?.rect;
      let res = null
      if (rect instanceof Object &&
        Object.hasOwn(rect, 'x') &&
        Object.hasOwn(rect, 'y') &&
        Object.hasOwn(rect, 'w') &&
        Object.hasOwn(rect, 'h')) {
        res = {
          rect: {
            x: rect.x,
            y: rect.y,
            w: rect.w,
            h: rect.h,
          },
          confidence: 0,
          sku: ''
        }
      }
      if (x instanceof Object &&
        Object.hasOwn(x, 'x') &&
        Object.hasOwn(x, 'y') &&
        Object.hasOwn(x, 'w') &&
        Object.hasOwn(x, 'h')) {
        res = {
          rect: {
            x: x.x,
            y: x.y,
            w: x.w,
            h: x.h,
          },
          confidence: 0,
          sku: ''
        }
      }
      if (res && x?.confidence) {
        res.confidence = x.confidence
      }
      if (res && x?.sku) {
        res.sku = x.sku
      }
      return res
    }).filter(x => x != null)
  }
  return res
}
