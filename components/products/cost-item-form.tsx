'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { validateCostItem } from '@/lib/products'
import { useProduct } from '@/components/product-provider'
import type { CostItem, CostType, CreateCostItemPayload } from '@/lib/accounting-types'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AddModeProps {
  mode: 'add'
  productId: string
  onSuccess?: () => void
  onCancel?: () => void
}

interface EditModeProps {
  mode: 'edit'
  productId: string
  costItem: CostItem
  onSuccess?: () => void
  onCancel?: () => void
}

type CostItemFormProps = AddModeProps | EditModeProps

interface FormValues {
  label: string
  costType: CostType
  amount: string
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Inline form for adding or editing a cost item.
 * - Add mode: no initial values, calls `addCostItem` from ProductProvider.
 * - Edit mode: pre-filled with existing cost item, calls `updateCostItem`.
 *
 * Validates via `validateCostItem` from lib/products.ts:
 * - label: required, max 150 characters
 * - costType: required (Variable | Fixed)
 * - amount: required, >= 0
 *
 * Validates: Requirements 2.1, 2.5
 */
export function CostItemForm(props: CostItemFormProps) {
  const { addCostItem, updateCostItem } = useProduct()

  const defaultValues: FormValues =
    props.mode === 'edit'
      ? {
          label: props.costItem.label,
          costType: props.costItem.costType,
          amount: String(props.costItem.amount),
        }
      : {
          label: '',
          costType: 'Variable',
          amount: '',
        }

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues,
  })

  // Reset form when the cost item being edited changes (e.g. parent re-renders with a new item)
  useEffect(() => {
    if (props.mode === 'edit') {
      reset({
        label: props.costItem.label,
        costType: props.costItem.costType,
        amount: String(props.costItem.amount),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mode === 'edit' ? props.costItem.id : null])

  const onSubmit = async (values: FormValues) => {
    const parsedAmount = parseFloat(values.amount)

    // Run validateCostItem from lib/products.ts for shared validation logic
    const payload: Partial<CreateCostItemPayload> = {
      label: values.label,
      costType: values.costType,
      amount: isNaN(parsedAmount) ? undefined : parsedAmount,
    }
    const validationErrors = validateCostItem(payload)
    if (Object.keys(validationErrors).length > 0) {
      // This path is a safety net — react-hook-form validate rules below
      // cover these same cases inline before submission reaches here.
      return
    }

    if (props.mode === 'add') {
      await addCostItem(props.productId, {
        label: values.label.trim(),
        costType: values.costType,
        amount: parsedAmount,
      })
    } else {
      await updateCostItem(props.productId, props.costItem.id, {
        label: values.label.trim(),
        costType: values.costType,
        amount: parsedAmount,
      })
    }

    if (props.mode === 'add') {
      reset({ label: '', costType: 'Variable', amount: '' })
    }

    props.onSuccess?.()
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      noValidate
      aria-label={props.mode === 'add' ? 'Add cost item' : 'Edit cost item'}
      className="flex flex-col gap-3"
    >
      {/* Label field */}
      <div className="grid gap-1.5">
        <Label htmlFor="cost-item-label">
          Label <span aria-hidden="true" className="text-destructive">*</span>
        </Label>
        <Input
          id="cost-item-label"
          placeholder="e.g. Raw materials"
          maxLength={150}
          aria-required="true"
          aria-invalid={!!errors.label}
          aria-describedby={errors.label ? 'cost-item-label-error' : undefined}
          {...register('label', {
            validate: (value) => {
              const errs = validateCostItem({ label: value })
              return errs.label ?? true
            },
          })}
        />
        {errors.label && (
          <p id="cost-item-label-error" role="alert" className="text-destructive text-sm">
            {errors.label.message}
          </p>
        )}
      </div>

      {/* Cost type selector */}
      <div className="grid gap-1.5">
        <Label htmlFor="cost-item-type">
          Type <span aria-hidden="true" className="text-destructive">*</span>
        </Label>
        <Controller
          control={control}
          name="costType"
          rules={{ required: 'Cost type is required.' }}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(val) => field.onChange(val as CostType)}
            >
              <SelectTrigger
                id="cost-item-type"
                className="w-full"
                aria-required="true"
                aria-invalid={!!errors.costType}
                aria-describedby={errors.costType ? 'cost-item-type-error' : undefined}
              >
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Variable">Variable</SelectItem>
                <SelectItem value="Fixed">Fixed</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {errors.costType && (
          <p id="cost-item-type-error" role="alert" className="text-destructive text-sm">
            {errors.costType.message}
          </p>
        )}
      </div>

      {/* Amount field */}
      <div className="grid gap-1.5">
        <Label htmlFor="cost-item-amount">
          Amount <span aria-hidden="true" className="text-destructive">*</span>
        </Label>
        <Input
          id="cost-item-amount"
          type="number"
          step="any"
          min={0}
          placeholder="0.00"
          aria-required="true"
          aria-invalid={!!errors.amount}
          aria-describedby={errors.amount ? 'cost-item-amount-error' : undefined}
          {...register('amount', {
            validate: (value) => {
              const parsed = parseFloat(value)
              const errs = validateCostItem({ amount: isNaN(parsed) ? undefined : parsed })
              return errs.amount ?? true
            },
          })}
        />
        {errors.amount && (
          <p id="cost-item-amount-error" role="alert" className="text-destructive text-sm">
            {errors.amount.message}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting
            ? props.mode === 'add'
              ? 'Adding…'
              : 'Saving…'
            : props.mode === 'add'
              ? 'Add cost item'
              : 'Save changes'}
        </Button>
        {props.onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={props.onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
