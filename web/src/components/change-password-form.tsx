'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from '@/lib/zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { H3 } from '@/components/ui/typography';
import { authApi } from '@/lib/api';
import { ModelsPasswordChangeRequest } from '@/api-client';

const formSchema = z
  .object({
    old_password: z.string().min(1, { message: 'Текущий пароль обязателен.' }),
    new_password: z
      .string()
      .min(6, {
        message: 'Новый пароль должен содержать не менее 6 символов.',
      }),
    confirm_password: z.string(),
  })
  .refine(data => data.new_password === data.confirm_password, {
    message: 'Пароли не совпадают.',
    path: ['confirm_password'],
  });

export function ChangePasswordForm() {
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      old_password: '',
      new_password: '',
      confirm_password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      await authApi.mePasswordPut({
        old_password: values.old_password,
        new_password: values.new_password,
      } as ModelsPasswordChangeRequest);
      toast.success('Пароль успешно изменен.');
      form.reset();
    } catch (error: any) {
      toast.error(error?.body?.error || 'Не удалось изменить пароль.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className='w-full h-full'>
      <CardHeader>
        <CardTitle>
          <H3>Изменить пароль</H3>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <FormField
              control={form.control}
              name='old_password'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Текущий пароль</FormLabel>
                  <FormControl>
                    <Input type='password' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='new_password'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Новый пароль</FormLabel>
                  <FormControl>
                    <Input type='password' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='confirm_password'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Подтвердите новый пароль</FormLabel>
                  <FormControl>
                    <Input type='password' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type='submit' disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
