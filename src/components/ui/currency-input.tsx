import { useEffect, useState } from "react";
import { Path, UseFormSetValue } from "react-hook-form";
import { Input } from "./input";

type Currency = {
    symbol: string;
};

type Props<T> = {
    label: string;
    name: Path<T>;
    setValue: UseFormSetValue<T>;
    value?: number; // ✅ tambahin ini
    error?: string;
    currency: Currency;
    placeholder?: string;
    autoFocus?: boolean;
};

export default function CurrencyInput<T>({
    label,
    name,
    setValue,
    value = 0, // ✅ default biar aman
    error,
    currency,
    placeholder = "0",
    autoFocus = false,
}: Props<T>) {
    const [display, setDisplay] = useState<string>("");

    const format = (val: number) => {
        if (!val) return "";
        return new Intl.NumberFormat("id-ID").format(val);
    };

    const parse = (val: string) => {
        return Number(val.replace(/[^0-9]/g, ""));
    };

    // ✅ sync saat edit / default value masuk
    useEffect(() => {
        setDisplay(format(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const numeric = parse(raw);

        setDisplay(format(numeric));
        setValue(name, numeric as any);
    };

    return (
        <div className="space-y-2">
            <label htmlFor={name}>{label}</label>

            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                    {currency.symbol}
                </span>

                <Input
                    id={name}
                    type="text"
                    inputMode="numeric"
                    value={display}
                    onChange={handleChange}
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    className="pl-10 text-lg font-semibold"
                />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}