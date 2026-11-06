import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ListingInput } from '@/api/listings';
import { categories, conditions, limits } from '@/lib/config';
import { errorMessage } from '@/lib/errors';
import { colors, spacing } from '@/theme/tokens';
import type { Condition } from '@/types/db';
import { Button, Chip, Input, Text } from '@/ui';
import { LocationPicker, type LatLng } from './LocationPicker';
import { PhotoPicker } from './PhotoPicker';

const schema = z.object({
  photos: z.array(z.string()).min(1, 'Add at least one photo').max(limits.maxPhotos),
  title: z.string().trim().min(3, 'At least 3 characters').max(80),
  category: z.string().min(1, 'Pick a category'),
  condition: z.enum(['new', 'like_new', 'good', 'fair']),
  description: z.string().trim().max(1000),
  looking_for: z.string().trim().max(200),
  location: z.object({ lat: z.number(), lng: z.number() }).nullable(),
}).superRefine((v, ctx) => {
  if (!v.location) ctx.addIssue({ code: 'custom', path: ['location'], message: 'Set where the item is' });
});
type Form = z.infer<typeof schema>;

interface Props {
  initial?: Partial<Form>;
  submitLabel: string;
  /** Receives the form values; local photo URIs are uploaded by the caller. */
  onSubmit: (v: ListingInput, location: LatLng) => Promise<void>;
  footer?: React.ReactNode;
}

export function ItemForm({ initial, submitLabel, onSubmit, footer }: Props) {
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      photos: [],
      title: '',
      category: '',
      condition: 'good',
      description: '',
      looking_for: '',
      location: null,
      ...initial,
    },
  });

  const submit = handleSubmit(async (v) => {
    setError(null);
    try {
      const { location, ...rest } = v;
      await onSubmit({ ...rest, condition: v.condition as Condition }, location!);
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Controller
          control={control}
          name="photos"
          render={({ field, fieldState }) => (
            <PhotoPicker value={field.value} onChange={field.onChange} max={limits.maxPhotos} error={fieldState.error?.message} />
          )}
        />
        <Controller
          control={control}
          name="title"
          render={({ field, fieldState }) => (
            <Input
              label="What is it?"
              placeholder="e.g. Yamaha acoustic guitar"
              value={field.value}
              onChangeText={field.onChange}
              maxLength={80}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="category"
          render={({ field, fieldState }) => (
            <View style={styles.group}>
              <Text variant="caption" muted style={styles.label}>
                Category
              </Text>
              <View style={styles.wrap}>
                {categories.map((c) => (
                  <Chip
                    key={c.slug}
                    label={c.label}
                    icon={c.icon}
                    selected={field.value === c.slug}
                    onPress={() => field.onChange(c.slug)}
                  />
                ))}
              </View>
              {fieldState.error && (
                <Text variant="caption" color={colors.danger}>
                  {fieldState.error.message}
                </Text>
              )}
            </View>
          )}
        />
        <Controller
          control={control}
          name="condition"
          render={({ field }) => (
            <View style={styles.group}>
              <Text variant="caption" muted style={styles.label}>
                Condition
              </Text>
              <View style={styles.wrap}>
                {conditions.map((c) => (
                  <Chip key={c.value} label={c.label} selected={field.value === c.value} onPress={() => field.onChange(c.value)} />
                ))}
              </View>
            </View>
          )}
        />
        <Controller
          control={control}
          name="description"
          render={({ field, fieldState }) => (
            <Input
              label="Details (optional)"
              placeholder="Size, age, what works, any marks or faults"
              value={field.value}
              onChangeText={field.onChange}
              multiline
              maxLength={1000}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="looking_for"
          render={({ field, fieldState }) => (
            <Input
              label="What would you like in return? (optional)"
              placeholder="e.g. a bicycle, board games, or open to offers"
              value={field.value}
              onChangeText={field.onChange}
              maxLength={200}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="location"
          render={({ field, fieldState }) => (
            <LocationPicker value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
          )}
        />
        {error && <Text color={colors.danger}>{error}</Text>}
        <Button label={submitLabel} loading={formState.isSubmitting} onPress={() => void submit()} />
        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl * 2 },
  group: { gap: spacing.sm },
  label: { marginLeft: 4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
