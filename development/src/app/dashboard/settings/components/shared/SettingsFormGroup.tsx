import { Label } from "@/components/ui/label";

interface SettingsFormGroupProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  required?: boolean;
  error?: string;
}

export function SettingsFormGroup({
  label,
  description,
  children,
  required,
  error
}: SettingsFormGroupProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {children}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
