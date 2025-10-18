import { apiRequest } from "@/lib/queryClient";

export async function generateQRCode(productId: string) {
    const response = await apiRequest("POST", `/api/products/${productId}/qr`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to generate QR code" }));
        throw new Error(errorData.message || "Failed to generate QR code");
    }
    return response.json();
}

export async function verifyQRCode(code: string) {
    const response = await apiRequest("GET", `/api/qr/${encodeURIComponent(code)}`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Invalid QR code" }));
        throw new Error(errorData.message || "Invalid QR code");
    }
    return response.json();
}