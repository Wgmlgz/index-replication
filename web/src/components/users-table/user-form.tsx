'use client';

import { z } from '@/lib/zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { User } from './columns';
import { useEffect, useState } from 'react';
import { usersApi as api } from '@/lib/api';
import {
  CreateUserRequest,
  UpdateUserRequest,
} from '@/api-client/api';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Switch } from '../ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { LockOpen, Lock, Trash } from 'lucide-react';
import { useUser } from '../user-context';
import { Textarea } from '../ui/textarea';
import axios from 'axios';

interface UserFormProps {
  mode: 'create' | 'edit';
  user?: User | null;
  onSuccess: () => void;
}

export const roleOptions = [
  {
    value: 1,
    label: 'Root',
    key: 'root',
    description:
      'Главный администратор системы с полными правами. Не может быть удален/изменен/заблокирован. Единственный в системе.',
  },
  {
    value: 2,
    label: 'Администратор',
    key: 'administrator',
    description:
      'Управление всей системой: пользователями, журналом и настройками.',
  },
  {
    value: 3,
    label: 'Руководитель',
    key: 'manager',
    description:
      'Руководитель команды. Управляет пользователями (Операторы/Наблюдатели), настройками.',
  },
  {
    value: 4,
    label: 'Оператор',
    key: 'operator',
    description:
      'Не может управлять пользователями или удалять данные.',
  },
  {
    value: 5,
    label: 'Наблюдатель',
    key: 'observer',
    description:
      'Нет возможности управления БВС или внесения изменений.',
  },
] as const;

const userFormSchema = z.object({
  username: z
    .string()
    .min(2, { message: 'Username must be at least 2 characters.' })
    .max(50)
    .optional(),
  full_name: z.string().min(2, { message: 'Full name is required.' }),
  phone: z.string().optional(),
  email: z.string().optional(),
  password: z.union([
    z.null(),
    z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  ]),
  role_id: z.string().min(1, { message: 'Role is required.' }),
  comment: z.string().optional(),
});

type UserFormValues = z.infer<typeof userFormSchema>;

export function UserForm({ mode, user, onSuccess }: UserFormProps) {
  const { hasPermission } = useUser();
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const showBlock = mode === 'edit' && hasPermission('users:block');
  const deleteKey = roleOptions.find(x => x.value === user?.role_id)?.key;
  const showDelete =
    mode === 'edit' &&
    hasPermission('users:delete') && (user?.blocked_at) &&
    (deleteKey ? hasPermission(`users:delete_role_${deleteKey}`) : false);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: user?.username || '',
      full_name: user?.full_name || '',
      phone: user?.phone || '',
      email: user?.email || '',
      password: '',
      role_id: user?.role_id ? String(user.role_id) : '2',
      comment: user?.comment || '',
    },
  });

  useEffect(() => {
    if (mode === 'edit' && user) {
      form.reset({
        username: user.username,
        password: null,
        full_name: user.full_name,
        role_id: String(user.role_id),
        phone: user.phone || '',
        email: user.email || '',
        comment: user?.comment || '',
      });
    } else if (mode === 'create') {
      form.reset({
        username: '',
        password: '',
        full_name: '',
        role_id: '',
        phone: '',
        email: '',
        comment: '',
        // blocked: false,
      });
    }
  }, [user, mode]);

  useEffect(() => {
    if (mode === 'create') {
      form.setValue('password', '');
      return;
    }
    if (mode === 'edit') {
      if (isChangingPassword) {
        form.setValue('password', '');
      } else {
        form.setValue('password', null);
      }
    }
  }, [isChangingPassword, mode]);

  const handleBlockToggle = async () => {
    try {
      if (!user) return;
      if (user.is_blocked) {
        await api.usersIdUnblockPost(user.id);
      } else {
        await api.usersIdBlockPost(user.id);
      }
      onSuccess();
    } catch (err) {
      let message = 'Network error';
      if (axios.isAxiosError(err)) {
        message = err.response?.data?.error ?? message;
      }
      setError('root', { type: 'server', message });
    }
  };

  const handleDelete = async () => {
    try {
      if (!user) return;
      await api.usersIdDelete(String(user.id));
      onSuccess();
    } catch (err) {
      let message = 'Network error';
      if (axios.isAxiosError(err)) {
        message = err.response?.data?.error ?? message;
      }
      setError('root', { type: 'server', message });
    }
  };
  const {
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = form;

  const onSubmit = async (values: UserFormValues) => {
    try {
      if (mode === 'create') {
        const body: CreateUserRequest = {
          username: values.username ?? '',
          full_name: values.full_name,
          // phone: values.phone,
          // email: values.email,
          password: values.password ?? '',
          role_id: Number(values.role_id),
          comment: values.comment,
        };
        await api.usersPost(body);
      } else if (mode === 'edit' && user) {
        const body: UpdateUserRequest = {
          full_name: values.full_name,
          phone: values.phone,
          email: values.email,
          role_id: Number(values.role_id),
          password: values.password ?? undefined,
          comment: values.comment,
        };
        await api.usersIdPut(user.id, body);
      }
      onSuccess();
    } catch (err) {
      let message = 'Network error';
      if (axios.isAxiosError(err)) {
        message = err.response?.data?.error ?? message;
      }
      setError('root', { type: 'server', message });
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className='space-y-4 grid grid-cols-2 gap-2'
      >
        <FormField
          control={form.control}
          name='username'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Логин</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  autoComplete='off'
                  disabled={mode === 'edit'}
                  placeholder='Ivan123'
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='full_name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>ФИО</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  autoComplete='off'
                  disabled={isSubmitting}
                  placeholder='Иванов Иван Иванович'
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='phone'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Номер телефона</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  autoComplete='off'
                  disabled={isSubmitting}
                  placeholder='88001234567'
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type='email'
                  {...field}
                  autoComplete='off'
                  disabled={isSubmitting}
                  placeholder='example@example.com'
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className='flex  gap-3 col-span-2'>
          {mode === 'edit' && (
            <div className='flex items-center gap-3'>
              <Switch
                id='resetPassword'
                checked={isChangingPassword}
                onCheckedChange={checked =>
                  setIsChangingPassword(Boolean(checked))
                }
              />
              <Label htmlFor='resetPassword'>Сбросить пароль</Label>
            </div>
          )}
          {/* {(mode === 'create' || (mode === 'edit' && isChangingPassword)) && (
            )} */}

          <FormField
            control={form.control}
            name='password'
            render={({ field }) => (
              <FormItem className='flex-grow'>
                {mode !== 'edit' && (
                  <FormLabel>
                    {/* {mode === "edit" ? "Новый пароль" : "Пароль"} */}
                    Пароль
                  </FormLabel>
                )}

                <FormControl>
                  <Input
                    placeholder={
                      mode === 'edit' ? 'Введите новый пароль' : 'Пароль'
                    }
                    type='password'
                    {...field}
                    value={field.value || ''}
                    autoComplete='new-password'
                    disabled={mode === 'edit' && !isChangingPassword}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name='role_id'
          render={({ field }) => (
            <FormItem className='col-span-2'>
              <FormLabel>Роль</FormLabel>
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                disabled={isSubmitting}
                defaultValue='2'
                className='grid gap-3 md:grid-cols-2'
              >
                {roleOptions
                  .toSpliced(0, 1)
                  .filter(opt =>
                    hasPermission(
                      `users:create_role_${opt.key}` satisfies `users:create_role_${typeof opt.key}`
                    )
                  )
                  .map(opt => (
                    <Label
                      className='has-[[data-state=checked]]:border-ring has-[[data-state=checked]]:bg-input/20 flex items-start gap-3 rounded-lg border p-3'
                      key={opt.value}
                    >
                      <RadioGroupItem
                        value={String(opt.value)}
                        id={String(opt.value)}
                        className='data-[state=checked]:border-primary'
                      />
                      <div className='grid gap-1 font-normal'>
                        <div className='font-medium'>{opt.label}</div>
                        <div className='text-muted-foreground text-xs leading-snug text-balance'>
                          {opt.description}
                        </div>
                      </div>
                    </Label>
                  ))}
              </RadioGroup>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className='col-span-2'>
          <FormField
            control={form.control}
            name='comment'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Комментарий</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    autoComplete='off'
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className='col-span-2'>
          {form.formState.errors.root && (
            <div className='text-red-600 text-sm'>
              {form.formState.errors.root.message}
            </div>
          )}
        </div>
        {showDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                className='col-span-2'
                variant={'destructive'}
                type='button'
              >
                <Trash /> Удалить
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                <AlertDialogDescription>
                  Пользователь будет удален
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  Продолжить
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {showBlock && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant={'destructive'} type='button'>
                {user?.is_blocked ? <LockOpen /> : <Lock />}{' '}
                {user?.is_blocked ? 'Разблокировать' : 'Заблокировать'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                <AlertDialogDescription>
                  {user?.is_blocked
                    ? 'Пользователь будет разблокирован, и он сможет войти в систему или пользоваться ей.'
                    : 'Пользователь будет заблокирован, и он не сможет войти в систему или пользоваться ей.'}
                  <br />
                  Изменение вступит в силу немедленно.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction onClick={handleBlockToggle}>
                  Продолжить
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <div style={{ gridColumn: showBlock ? '' : 'span 2 / span 2' }}>
          <Button type='submit' className='w-full' disabled={isSubmitting}>
            {isSubmitting
              ? mode === 'create'
                ? 'Creating...'
                : 'Saving...'
              : mode === 'create'
              ? 'Создать пользователя'
              : 'Сохранить изменения'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
