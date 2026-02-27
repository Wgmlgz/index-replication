'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from '@/lib/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

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
import { PasswordChangeRequest } from '@/api-client';

type ChangePasswordFormValues = {
  old_password: string;
  new_password: string;
  confirm_password: string;
};

const buildFormSchema = (t: TFunction) =>
  z
    .object({
      old_password: z.string().min(1, { message: String(t('settings.changePassword.validation.currentRequired')) }),
      new_password: z
        .string()
        .min(6, {
          message: String(t('settings.changePassword.validation.newMinLength')),
        }),
      confirm_password: z.string(),
    })
    .refine(data => data.new_password === data.confirm_password, {
      message: String(t('settings.changePassword.validation.passwordMismatch')),
      path: ['confirm_password'],
    });

export function ChangePasswordForm() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const formSchema = useMemo(() => buildFormSchema(t), [t]);

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      old_password: '',
      new_password: '',
      confirm_password: '',
    },
  });

  async function onSubmit(values: ChangePasswordFormValues) {
    setLoading(true);
    try {
      await authApi.mePasswordPut({
        old_password: values.old_password,
        new_password: values.new_password,
      } as PasswordChangeRequest);
      toast.success(t('settings.changePassword.success'));
      form.reset();
    } catch (error: unknown) {
      const message =
        typeof error === 'object' &&
          error !== null &&
          'body' in error &&
          typeof (error as { body?: { error?: unknown } }).body?.error === 'string'
          ? (error as { body: { error: string } }).body.error
          : t('settings.changePassword.error');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className='w-full h-full'>
      <CardHeader>
        <CardTitle>
          <H3>{t('settings.changePassword.title')}</H3>
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
                  <FormLabel>{t('settings.changePassword.currentPasswordLabel')}</FormLabel>
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
                  <FormLabel>{t('settings.changePassword.newPasswordLabel')}</FormLabel>
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
                  <FormLabel>{t('settings.changePassword.confirmPasswordLabel')}</FormLabel>
                  <FormControl>
                    <Input type='password' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type='submit' disabled={loading}>
              {loading ? t('settings.changePassword.saving') : t('settings.changePassword.save')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
