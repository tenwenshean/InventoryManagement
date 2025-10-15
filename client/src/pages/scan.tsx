import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode } from "lucide-react";

export default function ScanPage() {
  const [, params] = useRoute("/scan/:code");
  const code = params?.code ? decodeURIComponent(params.code) : "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<any | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const qrImageUrl = (size = 200) => {
    const target = `${window.location.origin}/scan/${encodeURIComponent(code)}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(target)}`;
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/qr/${encodeURIComponent(code)}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const js = await res.json();
        if (!mounted) return;
        setProduct(js.product);
      } catch (e: any) {
        if (!mounted) return;
        setError("QR not found or invalid");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [code]);

  const confirmSale = async () => {
    try {
      setConfirming(true);
      const res = await fetch(`/api/qr/${encodeURIComponent(code)}/confirm-sale`, { method: "POST" });
      if (!res.ok) throw new Error(`${res.status}`);
      const js = await res.json();
      setProduct(js.product);
      setConfirmed(true);
    } catch (e) {
      setError("Failed to confirm sale. Try again.");
    } finally {
      setConfirming(false);
    }
  };

  const addToPending = () => {
    if (!product) return;
    const key = "pendingPayment";
    const current = JSON.parse(localStorage.getItem(key) || "[]");
    const next = [...current, { id: product.id, name: product.name, price: product.price, sku: product.sku, qty: 1 }];
    localStorage.setItem(key, JSON.stringify(next));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode size={20} /> Scan Product
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : error ? (
            <div className="text-destructive">{error}</div>
          ) : !product ? (
            <div className="text-muted-foreground">QR not found.</div>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <img src={qrImageUrl(160)} alt="QR" className="mx-auto mb-3" />
                <div className="font-semibold">{product.name}</div>
                <div className="text-sm text-muted-foreground">SKU: {product.sku}</div>
                <div className="text-sm text-muted-foreground">Price: ${product.price}</div>
                <div className="text-sm text-muted-foreground">In stock: {product.quantity ?? 0}</div>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" variant="outline" onClick={addToPending}>
                  Add to Pending Payment
                </Button>
                <Button className="flex-1" onClick={confirmSale} disabled={confirming}>
                  {confirming ? "Confirming…" : "Mark as Sold"}
                </Button>
              </div>
              {confirmed && (
                <div className="text-center text-green-600 font-medium">Marked as sold.</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


