import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Smartphone, Lock, Loader2 } from "lucide-react";
import { initRecaptcha, sendOTP, verifyOTP } from "@/lib/firebaseClient";
import type { RecaptchaVerifier } from "firebase/auth";

interface CustomerLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: any) => void;
}

export default function CustomerLoginModal({
  isOpen,
  onClose,
  onLoginSuccess,
}: CustomerLoginModalProps) {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+60"); // Default Malaysia
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);
  const { toast } = useToast();

  // Initialize reCAPTCHA when modal opens
  useEffect(() => {
    if (isOpen && !recaptchaVerifier && step === "phone") {
      // Delay to ensure DOM is fully ready
      const timer = setTimeout(() => {
        try {
          // Clear any existing reCAPTCHA
          const container = document.getElementById("recaptcha-container");
          if (container) {
            container.innerHTML = "";
          }
          
          console.log("🔧 Starting reCAPTCHA initialization...");
          
          // Use visible reCAPTCHA for better reliability
          const verifier = initRecaptcha("recaptcha-container", true);
          setRecaptchaVerifier(verifier);
          
          console.log("✅ reCAPTCHA ready to use");
        } catch (error: any) {
          console.error("❌ Error initializing reCAPTCHA:", error);
          toast({
            title: "Setup Error",
            description: "Enable Phone Authentication in Firebase Console",
            variant: "destructive",
          });
        }
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [isOpen, recaptchaVerifier, step, toast]);

  // Cleanup reCAPTCHA when modal closes
  useEffect(() => {
    if (!isOpen && recaptchaVerifier) {
      try {
        recaptchaVerifier.clear();
        setRecaptchaVerifier(null);
        const container = document.getElementById("recaptcha-container");
        if (container) {
          container.innerHTML = "";
        }
      } catch (error) {
        console.error("Error cleaning up reCAPTCHA:", error);
      }
    }
  }, [isOpen, recaptchaVerifier]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep("phone");
      setPhoneNumber("");
      setOtp("");
      setConfirmationResult(null);
    }
  }, [isOpen]);

  const handleSendOTP = async () => {
    if (!phoneNumber || phoneNumber.length < 7) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid phone number",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const fullPhoneNumber = `${countryCode}${phoneNumber}`;

    try {
      if (!recaptchaVerifier) {
        throw new Error("reCAPTCHA not initialized");
      }

      const confirmation = await sendOTP(fullPhoneNumber, recaptchaVerifier);
      setConfirmationResult(confirmation);
      setStep("otp");
      
      toast({
        title: "OTP Sent!",
        description: `Verification code sent to ${fullPhoneNumber}`,
      });
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send OTP. Please try again.",
        variant: "destructive",
      });
      
      // Reinitialize reCAPTCHA on error
      try {
        const verifier = initRecaptcha("recaptcha-container");
        setRecaptchaVerifier(verifier);
      } catch (e) {
        console.error("Error reinitializing reCAPTCHA:", e);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter the 6-digit code",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const result = await verifyOTP(confirmationResult, otp);
      
      toast({
        title: "Login Successful!",
        description: "Welcome to InventoryPro Store",
      });

      onLoginSuccess(result.user);
      onClose();
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      toast({
        title: "Invalid Code",
        description: "The code you entered is incorrect. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setOtp("");
    setStep("phone");
    toast({
      title: "Resend OTP",
      description: "Please request a new code",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Smartphone className="w-6 h-6 text-red-600" />
            Customer Login
          </DialogTitle>
          <DialogDescription>
            {step === "phone"
              ? "Enter your phone number to receive a verification code"
              : "Enter the 6-digit code sent to your phone"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {step === "phone" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="country-code">Country Code</Label>
                <select
                  id="country-code"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="+60">🇲🇾 Malaysia (+60)</option>
                  <option value="+65">🇸🇬 Singapore (+65)</option>
                  <option value="+1">🇺🇸 United States (+1)</option>
                  <option value="+44">🇬🇧 United Kingdom (+44)</option>
                  <option value="+86">🇨🇳 China (+86)</option>
                  <option value="+91">🇮🇳 India (+91)</option>
                  <option value="+62">🇮🇩 Indonesia (+62)</option>
                  <option value="+63">🇵🇭 Philippines (+63)</option>
                  <option value="+66">🇹🇭 Thailand (+66)</option>
                  <option value="+84">🇻🇳 Vietnam (+84)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="flex gap-2">
                  <div className="flex items-center px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-semibold">
                    {countryCode}
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="123456789"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        handleSendOTP();
                      }
                    }}
                    className="flex-1"
                    disabled={isLoading}
                  />
                </div>
                <p className="text-sm text-gray-500">
                  Enter your phone number without the country code
                </p>
              </div>

              {/* reCAPTCHA container - only show on phone step */}
              <div className="space-y-2">
                <div className="flex justify-center items-center min-h-[78px] bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-4 relative z-[9999]">
                  <div id="recaptcha-container" className="relative z-[9999]"></div>
                </div>
                <p className="text-xs text-center text-gray-500">
                  ⚠️ If reCAPTCHA doesn't appear, enable Phone Auth in Firebase Console
                </p>
              </div>

              <Button
                onClick={handleSendOTP}
                disabled={isLoading || !phoneNumber || !recaptchaVerifier}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending Code...
                  </>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4 mr-2" />
                    Send Verification Code
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="otp">Verification Code</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && otp.length === 6) {
                      handleVerifyOTP();
                    }
                  }}
                  className="text-center text-2xl tracking-widest font-bold"
                  maxLength={6}
                  disabled={isLoading}
                  autoFocus
                />
                <p className="text-sm text-gray-500 text-center">
                  Code sent to {countryCode}{phoneNumber}
                </p>
              </div>

              <Button
                onClick={handleVerifyOTP}
                disabled={isLoading || otp.length !== 6}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Verify & Login
                  </>
                )}
              </Button>

              <Button
                onClick={handleResendOTP}
                variant="outline"
                className="w-full"
                disabled={isLoading}
              >
                Resend Code
              </Button>
            </>
          )}
        </div>

        <div className="text-center text-sm text-gray-500 space-y-2">
          <p>By logging in, you agree to our Terms & Conditions</p>
          <p className="text-xs text-gray-400">
            Protected by reCAPTCHA and Google Privacy Policy
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
