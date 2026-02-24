"use client"

import { useUser } from "@/components/user-context";
import { Time } from "@/components/ui/time";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { H2, H3 } from "@/components/ui/typography";
import { ChangePasswordForm } from "@/components/change-password-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { TelegramVerificationCard } from "@/components/telegram-verification-card";
import { useLocalStorage } from 'react-use';
import { LOCAL_STORAGE_BASE_URL } from "@/lib/api";
import { LOCAL_STORAGE_DEFAULT_THRESHOLD, LOCAL_STORAGE_ONE_OTHER_THRESHOLD, LOCAL_STORAGE_ONE_THRESHOLD } from "@/lib/utils";

const ChangeServerUrl = () => {
  const [apiUrl, setApiUrl] = useLocalStorage(LOCAL_STORAGE_BASE_URL, "");
  const [defaultThreshold, setDefaultThreshold] = useLocalStorage<number>(LOCAL_STORAGE_DEFAULT_THRESHOLD, 0.75);
  const [oneThreshold, setOneThreshold] = useLocalStorage<number>(LOCAL_STORAGE_ONE_THRESHOLD, 0.8);
  const [oneOtherThreshold, setOneOtherThreshold] = useLocalStorage<number>(LOCAL_STORAGE_ONE_OTHER_THRESHOLD, 0.8);

  return <>
    <Card className="h-full w-full">
      <CardHeader>
        <CardTitle>
          <H3>
            Настройки
          </H3>
        </CardTitle>
      </CardHeader>

      <CardContent className="gap-4 grid lg:grid-cols-2">
        <div className="grid gap-3">
          <Label htmlFor="username">Логин</Label>
          <Input
            id="username"
            type="text"
            placeholder="http://localhost:8080"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-3">
          <Label htmlFor="threshold">default threshold</Label>
          <Input
            id="threshold"
            type="number"
            placeholder="0.75"
            value={defaultThreshold}
            onChange={(e) => setDefaultThreshold(Number(e.target.value))}
            required
          />
        </div>
        <div className="grid gap-3">
          <Label htmlFor="threshold">one threshold</Label>
          <Input
            id="threshold"
            type="number"
            placeholder="0.8"
            value={oneThreshold}
            onChange={(e) => setOneThreshold(Number(e.target.value))}
            required
          />
        </div>
        <div className="grid gap-3">
          <Label htmlFor="threshold">one other threshold</Label>
          <Input
            id="threshold"
            type="number"
            placeholder="0.8"
            value={oneOtherThreshold}
            onChange={(e) => setOneOtherThreshold(Number(e.target.value))}
            required
          />
        </div>
        {/* <div className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Вход..." : "Войти"}
          </Button>
        </div> */}
      </CardContent>
    </Card>
  </>
}


export default function SettingsPage() {
  const { user, loading } = useUser();

  return (
    <>
      {loading ? <div>Загрузка...</div> :
        <div className="grid items-center justify-items-center">
          <div className="grid lg:grid-cols-3 gap-4 max-w-[1000px]">
            <div className="col-span-3 lg:col-span-3">
              <ChangeServerUrl></ChangeServerUrl>
            </div>
            <Card className="h-full w-full col-span-2">
              <CardHeader>
                <CardTitle>
                  <H3>
                    Информация о текущем пользователе
                  </H3>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4 grid grid-cols-2">
                <>
                  {user ?
                    <>
                      <div className="space-y-4">
                        <div><b>Логин:</b> {user.username}</div>
                        <div><b>ФИО:</b> {user.full_name}</div>
                        <div><b>Email:</b> {user.email || <span className="text-muted-foreground">(нет)</span>}</div>
                        <div><b>Роль:</b> {user.role_key}</div>
                      </div>
                      <div className="space-y-4">
                        <div><b>Телефон:</b> {user.phone || <span className="text-muted-foreground">(нет)</span>}</div>
                        <div><b>Заблокирован:</b> {user.is_blocked ? 'Да' : 'Нет'}</div>
                        <div><b>Создан:</b> <Time className="inline" time={user.created_at} /></div>
                        <div><b>Последняя активность:</b> <Time className="inline" time={user.last_active} fallback="(никогда)" /></div>
                      </div>
                    </> : <div>Не авторизован.</div>
                  }
                </>

              </CardContent>
            </Card>
            {user &&
              <div className="col-span-2 lg:col-span-1">
                <ChangePasswordForm />
              </div>}
            {user &&
              <div className="col-span-3">
                <TelegramVerificationCard />
              </div>}
          </div>
        </div >}
    </>

  );
}
