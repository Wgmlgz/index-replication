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
import { useEffect } from 'react';
import { usersApi as api } from '@/lib/api';
import { CreateUserRequest, UpdateUserRequest } from '@/api-client/api';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
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
import { getApiErrorMessage } from '@/lib/error-utils';

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
    description: 'System superuser with full permissions.',
  },
  {
    value: 2,
    label: 'Administrator',
    key: 'administrator',
    description: 'Manages users, logs, and system settings.',
  },
  {
    value: 3,
    label: 'Manager',
    key: 'manager',
    description: 'Manages operators/observers and team-level settings.',
  },
  {
    value: 4,
    label: 'Operator',
    key: 'operator',
    description: 'Operational role with limited administration rights.',
  },
  {
    value: 5,
    label: 'Observer',
    key: 'observer',
    description: 'Read-only role for monitoring.',
  },
] as const;

const userFormSchema = z.object({
  username: z
    .string()
    .min(2, { message: 'Username must be at least 2 characters.' })
    .max(50)
    .optional(),
  full_name: z.string().min(2, { message: 'Full name is required.' }),
  role_id: z.string().min(1, { message: 'Role is required.' }),
  comment: z.string().optional(),
});

type UserFormValues = z.infer<typeof userFormSchema>;

export function UserForm({ mode, user, onSuccess }: UserFormProps) {
  const { hasPermission } = useUser();

  const showBlock = mode === 'edit' && hasPermission('users:block');
  const deleteKey = roleOptions.find(x => x.value === user?.role_id)?.key;
  const showDelete =
    mode === 'edit' &&
    hasPermission('users:delete') &&
    user?.blocked_at &&
    (deleteKey ? hasPermission(`users:delete_role_${deleteKey}`) : false);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: user?.username || '',
      full_name: user?.full_name || '',
      role_id: user?.role_id ? String(user.role_id) : '2',
      comment: user?.comment || '',
    },
  });

  useEffect(() => {
    if (mode === 'edit' && user) {
      form.reset({
        username: user.username,
        full_name: user.full_name,
        role_id: String(user.role_id),
        comment: user?.comment || '',
      });
    } else if (mode === 'create') {
      form.reset({
        username: '',
        full_name: '',
        role_id: '',
        comment: '',
      });
    }
  }, [form, mode, user]);

  const {
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = form;

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
        message = getApiErrorMessage(err.response?.data as unknown) ?? message;
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
        message = getApiErrorMessage(err.response?.data as unknown) ?? message;
      }
      setError('root', { type: 'server', message });
    }
  };

  const onSubmit = async (values: UserFormValues) => {
    try {
      if (mode === 'create') {
        const body = {
          username: values.username ?? '',
          full_name: values.full_name,
          role_id: Number(values.role_id),
          comment: values.comment,
        } as CreateUserRequest;
        await api.usersPost(body);
      } else if (mode === 'edit' && user) {
        const body: UpdateUserRequest = {
          full_name: values.full_name,
          role_id: Number(values.role_id),
          comment: values.comment,
        };
        await api.usersIdPut(user.id, body);
      }
      onSuccess();
    } catch (err) {
      let message = 'Network error';
      if (axios.isAxiosError(err)) {
        message = getApiErrorMessage(err.response?.data as unknown) ?? message;
      }
      setError('root', { type: 'server', message });
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={event => {
          void handleSubmit(onSubmit)(event);
        }}
        className='space-y-4 grid grid-cols-2 gap-2'
      >
        <FormField
          control={form.control}
          name='username'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Login</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  autoComplete='off'
                  disabled={mode === 'edit'}
                  placeholder='ivan123'
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
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  autoComplete='off'
                  disabled={isSubmitting}
                  placeholder='Ivan Ivanov'
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='role_id'
          render={({ field }) => (
            <FormItem className='col-span-2'>
              <FormLabel>Role</FormLabel>
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
                <FormLabel>Comment</FormLabel>
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
                <Trash /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This user will be deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleDelete()}>
                  Continue
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
                {user?.is_blocked ? 'Unblock' : 'Block'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  {user?.is_blocked
                    ? 'The user will be unblocked immediately.'
                    : 'The user will be blocked immediately.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleBlockToggle()}>
                  Continue
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
                ? 'Create user'
                : 'Save changes'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
