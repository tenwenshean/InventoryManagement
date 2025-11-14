import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Save,
  Loader2
} from "lucide-react";
import { auth } from "@/lib/firebaseClient";
import { onAuthStateChanged, updateProfile } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";

export default function CustomerProfile() {
  const [customerUser, setCustomerUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  // Profile form state
  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    phoneNumber: "",
    address: "",
    city: "",
    postalCode: "",
    country: ""
  });

  // Listen to auth state
  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCustomerUser(user);
        // Load user data into form
        setFormData({
          displayName: user.displayName || "",
          email: user.email || "",
          phoneNumber: user.phoneNumber || "",
          address: localStorage.getItem("customer_address") || "",
          city: localStorage.getItem("customer_city") || "",
          postalCode: localStorage.getItem("customer_postalCode") || "",
          country: localStorage.getItem("customer_country") || ""
        });
      } else {
        // Redirect to customer portal if not logged in
        setLocation("/customer");
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [setLocation]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveProfile = async () => {
    if (!customerUser) return;

    setIsSaving(true);
    try {
      // Update Firebase Auth display name if changed
      if (formData.displayName !== customerUser.displayName) {
        await updateProfile(customerUser, {
          displayName: formData.displayName
        });
      }

      // Save other fields to localStorage (you can also save to Firestore)
      localStorage.setItem("customer_address", formData.address);
      localStorage.setItem("customer_city", formData.city);
      localStorage.setItem("customer_postalCode", formData.postalCode);
      localStorage.setItem("customer_country", formData.country);

      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully.",
      });

      // Reload auth state to get updated displayName
      await customerUser.reload();
      
    } catch (error: any) {
      console.error("Error saving profile:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save profile.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/customer">
                <Button variant="ghost" className="text-white hover:bg-white/10">
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Back to Store
                </Button>
              </Link>
              <div className="flex items-center space-x-3">
                <User className="w-8 h-8" />
                <div>
                  <h1 className="text-xl font-bold">My Profile</h1>
                  <p className="text-xs text-red-100">Manage your account information</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Profile Form */}
      <section className="container mx-auto px-6 py-8">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                Update your personal information and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="displayName" className="flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span>Display Name</span>
                </Label>
                <Input
                  id="displayName"
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleInputChange}
                  placeholder="Enter your name"
                />
              </div>

              {/* Email (Read-only) */}
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center space-x-2">
                  <Mail className="w-4 h-4" />
                  <span>Email Address</span>
                </Label>
                <Input
                  id="email"
                  name="email"
                  value={formData.email}
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500">
                  Email cannot be changed. This is your login email.
                </p>
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <Label htmlFor="phoneNumber" className="flex items-center space-x-2">
                  <Phone className="w-4 h-4" />
                  <span>Phone Number</span>
                </Label>
                <Input
                  id="phoneNumber"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  placeholder="+1 234 567 8900"
                />
              </div>

              {/* Shipping Address Section */}
              <div className="border-t pt-6 mt-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                  <MapPin className="w-5 h-5" />
                  <span>Shipping Address</span>
                </h3>

                {/* Address */}
                <div className="space-y-2 mb-4">
                  <Label htmlFor="address">Street Address</Label>
                  <Textarea
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Enter your street address"
                    rows={3}
                  />
                </div>

                {/* City and Postal Code */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      placeholder="City"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      name="postalCode"
                      value={formData.postalCode}
                      onChange={handleInputChange}
                      placeholder="12345"
                    />
                  </div>
                </div>

                {/* Country */}
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    placeholder="Country"
                  />
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end space-x-3 pt-6 border-t">
                <Link href="/customer">
                  <Button variant="outline">
                    Cancel
                  </Button>
                </Link>
                <Button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Profile
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Account Info */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-600">User ID</span>
                <span className="text-sm font-mono">{customerUser?.uid}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-600">Account Created</span>
                <span className="text-sm">
                  {customerUser?.metadata?.creationTime 
                    ? new Date(customerUser.metadata.creationTime).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-600">Last Sign In</span>
                <span className="text-sm">
                  {customerUser?.metadata?.lastSignInTime 
                    ? new Date(customerUser.metadata.lastSignInTime).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
