import { useState, useEffect } from "react";
import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { 
  Settings,  User, Bell, Shield,  Database,  Mail,  Palette,  Package,  DollarSign,AlertTriangle, Save, RefreshCw, Clock, Store, Upload, Image as ImageIcon} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { uploadImage } from "@/lib/imageUpload";

// Timezone options with UTC offsets
const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)", offset: "UTC-5" },
  { value: "America/Chicago", label: "Central Time (CT)", offset: "UTC-6" },
  { value: "America/Denver", label: "Mountain Time (MT)", offset: "UTC-7" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)", offset: "UTC-8" },
  { value: "Europe/London", label: "London (GMT)", offset: "UTC+0" },
  { value: "Europe/Paris", label: "Paris (CET)", offset: "UTC+1" },
  { value: "Asia/Dubai", label: "Dubai (GST)", offset: "UTC+4" },
  { value: "Asia/Singapore", label: "Singapore (SGT)", offset: "UTC+8" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)", offset: "UTC+9" },
  { value: "Australia/Sydney", label: "Sydney (AEDT)", offset: "UTC+11" },
  { value: "UTC", label: "UTC (Coordinated Universal Time)", offset: "UTC+0" },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [companyName, setCompanyName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [currentTime, setCurrentTime] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  // Shop Profile States
  const [shopSlug, setShopSlug] = useState("");
  const [shopDescription, setShopDescription] = useState("");
  const [shopBannerUrl, setShopBannerUrl] = useState("");
  const [shopLogoUrl, setShopLogoUrl] = useState("");
  const [shopEmail, setShopEmail] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopWebsite, setShopWebsite] = useState("");
  const [shopFacebook, setShopFacebook] = useState("");
  const [shopInstagram, setShopInstagram] = useState("");
  const [shopTwitter, setShopTwitter] = useState("");
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem(`settings_${user?.uid}`);
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setCompanyName(settings.companyName || "");
      setTimezone(settings.timezone || "UTC");
      setShopSlug(settings.shopSlug || "");
      setShopDescription(settings.shopDescription || "");
      setShopBannerUrl(settings.shopBannerUrl || "");
      setShopLogoUrl(settings.shopLogoUrl || "");
      setShopEmail(settings.shopEmail || "");
      setShopPhone(settings.shopPhone || "");
      setShopAddress(settings.shopAddress || "");
      setShopWebsite(settings.shopWebsite || "");
      setShopFacebook(settings.shopFacebook || "");
      setShopInstagram(settings.shopInstagram || "");
      setShopTwitter(settings.shopTwitter || "");
    }
  }, [user]);

  // Update current time based on selected timezone
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeString = now.toLocaleTimeString("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      const dateString = now.toLocaleDateString("en-US", {
        timeZone: timezone,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      setCurrentTime(`${dateString}, ${timeString}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [timezone]);

  // Validate and format shop slug
  const handleShopSlugChange = (value: string) => {
    // Remove spaces, convert to lowercase, keep only alphanumeric and hyphens
    const formatted = value
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    setShopSlug(formatted);
  };

  // Save settings
  const handleSaveSettings = async () => {
    // Validate shop slug
    if (shopSlug && shopSlug.length < 3) {
      toast({
        title: "Invalid Shop URL",
        description: "Shop URL must be at least 3 characters long.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    const settings = {
      companyName,
      timezone,
      shopSlug,
      shopDescription,
      shopBannerUrl,
      shopLogoUrl,
      shopEmail,
      shopPhone,
      shopAddress,
      shopWebsite,
      shopFacebook,
      shopInstagram,
      shopTwitter,
      updatedAt: new Date().toISOString(),
    };
    
    console.log('Saving settings for user:', user?.uid);
    console.log('Settings data:', settings);
    
    // Save to localStorage
    localStorage.setItem(`settings_${user?.uid}`, JSON.stringify(settings));
    
    // Also save to Firestore user document
    try {
      if (user?.uid) {
        console.log('Making API request to:', `/api/users/${user.uid}/settings`);
        const response = await apiRequest(
          'PUT',
          `/api/users/${user.uid}/settings`,
          settings
        );
        
        console.log('API response status:', response.status);
        const responseData = await response.json();
        console.log('API response data:', responseData);
        
        toast({
          title: "Settings Saved",
          description: "Your settings have been updated successfully.",
        });
      }
    } catch (error) {
      console.error('Error saving settings to server:', error);
      toast({
        title: "Warning",
        description: "Settings saved locally but failed to sync to server.",
        variant: "destructive",
      });
    }
    
    setIsSaving(false);
  };

  // Handle banner upload
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingBanner(true);
    try {
      const imageUrl = await uploadImage(file, "shop-banners");
      setShopBannerUrl(imageUrl);
      toast({
        title: "Banner Uploaded",
        description: "Shop banner uploaded successfully. Don't forget to save settings.",
      });
    } catch (error) {
      console.error("Error uploading banner:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload banner image.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingBanner(false);
    }
  };

  // Handle logo upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingLogo(true);
    try {
      const imageUrl = await uploadImage(file, "shop-logos");
      setShopLogoUrl(imageUrl);
      toast({
        title: "Logo Uploaded",
        description: "Shop logo uploaded successfully. Don't forget to save settings.",
      });
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload logo image.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 overflow-auto"
        style={{
          background: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)",
        }}
      >
      <div className="container mx-auto p-6 space-y-6" data-testid="settings-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="settings-title">
              Settings
            </h1>
            <p className="text-gray-600 dark:text-gray-400" data-testid="settings-description">
              Manage your inventory system preferences and configurations
            </p>
          </div>
          <Button 
            className="bg-red-600 hover:bg-red-700" 
            onClick={handleSaveSettings}
            disabled={isSaving}
            data-testid="button-save-settings"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Settings Navigation */}
          <div className="lg:col-span-1">
            <Card data-testid="settings-navigation">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-red-600" />
                  Settings Menu
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="ghost" className="w-full justify-start" data-testid="nav-general">
                  <User className="w-4 h-4 mr-2" />
                  General
                </Button>
                <Button variant="ghost" className="w-full justify-start" data-testid="nav-inventory">
                  <Package className="w-4 h-4 mr-2" />
                  Inventory
                </Button>
                <Button variant="ghost" className="w-full justify-start" data-testid="nav-accounting">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Accounting
                </Button>
                <Button variant="ghost" className="w-full justify-start" data-testid="nav-notifications">
                  <Bell className="w-4 h-4 mr-2" />
                  Notifications
                </Button>
                <Button variant="ghost" className="w-full justify-start" data-testid="nav-security">
                  <Shield className="w-4 h-4 mr-2" />
                  Security
                </Button>
                <Button variant="ghost" className="w-full justify-start" data-testid="nav-database">
                  <Database className="w-4 h-4 mr-2" />
                  Database
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Settings Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* General Settings */}
            <Card data-testid="settings-general">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="w-5 h-5 mr-2 text-red-600" />
                  General Settings
                </CardTitle>
                <CardDescription>Basic system configuration and preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Current Time Display */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <div>
                      <h4 className="font-medium text-blue-800 dark:text-blue-200">Current Time</h4>
                      <p className="text-sm text-blue-600 dark:text-blue-400">{currentTime}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company-name" data-testid="label-company-name">Company Name</Label>
                    <Input 
                      id="company-name" 
                      placeholder="InventoryPro Enterprise" 
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      data-testid="input-company-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone" data-testid="label-timezone">Timezone</Label>
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger data-testid="select-timezone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label} ({tz.offset})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shop Profile Settings */}
            <Card data-testid="settings-shop-profile">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Store className="w-5 h-5 mr-2 text-red-600" />
                  Shop Profile
                </CardTitle>
                <CardDescription>Customize your shop page for customers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Shop URL */}
                <div className="space-y-2">
                  <Label htmlFor="shop-slug">Shop URL</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 whitespace-nowrap">localhost:5000/shop/</span>
                    <Input
                      id="shop-slug"
                      placeholder="my-shop-name"
                      value={shopSlug}
                      onChange={(e) => handleShopSlugChange(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Choose a unique URL for your shop. Only lowercase letters, numbers, and hyphens allowed. No spaces.
                  </p>
                  {shopSlug && (
                    <p className="text-xs text-blue-600">
                      Your shop will be available at: <span className="font-mono font-medium">/shop/{shopSlug}</span>
                    </p>
                  )}
                </div>

                <Separator />

                {/* Shop Description */}
                <div className="space-y-2">
                  <Label htmlFor="shop-description">Shop Description</Label>
                  <Textarea
                    id="shop-description"
                    placeholder="Tell customers about your business, products, and what makes you unique..."
                    value={shopDescription}
                    onChange={(e) => setShopDescription(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    This will be displayed on your shop page
                  </p>
                </div>

                <Separator />

                {/* Shop Images */}
                <div className="space-y-4">
                  <h4 className="font-medium">Shop Images</h4>
                  
                  {/* Banner Upload */}
                  <div className="space-y-2">
                    <Label htmlFor="shop-banner">Shop Banner</Label>
                    <div className="flex items-start gap-4">
                      {shopBannerUrl && (
                        <div className="relative w-full h-32 rounded-lg overflow-hidden border">
                          <img
                            src={shopBannerUrl}
                            alt="Shop banner preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-shrink-0">
                        <Label htmlFor="banner-upload" className="cursor-pointer">
                          <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-accent">
                            <Upload className="w-4 h-4" />
                            <span className="text-sm">
                              {isUploadingBanner ? "Uploading..." : "Upload Banner"}
                            </span>
                          </div>
                        </Label>
                        <Input
                          id="banner-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleBannerUpload}
                          disabled={isUploadingBanner}
                          className="hidden"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Recommended size: 1200x300px. This appears at the top of your shop page.
                    </p>
                  </div>

                  {/* Logo Upload */}
                  <div className="space-y-2">
                    <Label htmlFor="shop-logo">Shop Logo</Label>
                    <div className="flex items-start gap-4">
                      {shopLogoUrl && (
                        <div className="relative w-24 h-24 rounded-lg overflow-hidden border">
                          <img
                            src={shopLogoUrl}
                            alt="Shop logo preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-shrink-0">
                        <Label htmlFor="logo-upload" className="cursor-pointer">
                          <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-accent">
                            <ImageIcon className="w-4 h-4" />
                            <span className="text-sm">
                              {isUploadingLogo ? "Uploading..." : "Upload Logo"}
                            </span>
                          </div>
                        </Label>
                        <Input
                          id="logo-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          disabled={isUploadingLogo}
                          className="hidden"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Recommended size: 200x200px. Square images work best.
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Contact Information */}
                <div className="space-y-4">
                  <h4 className="font-medium">Contact Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="shop-email">Email</Label>
                      <Input
                        id="shop-email"
                        type="email"
                        placeholder="contact@yourshop.com"
                        value={shopEmail}
                        onChange={(e) => setShopEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shop-phone">Phone</Label>
                      <Input
                        id="shop-phone"
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        value={shopPhone}
                        onChange={(e) => setShopPhone(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shop-address">Address</Label>
                    <Input
                      id="shop-address"
                      placeholder="123 Main St, City, State, ZIP"
                      value={shopAddress}
                      onChange={(e) => setShopAddress(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shop-website">Website</Label>
                    <Input
                      id="shop-website"
                      type="url"
                      placeholder="https://yourshop.com"
                      value={shopWebsite}
                      onChange={(e) => setShopWebsite(e.target.value)}
                    />
                  </div>
                </div>

                <Separator />

                {/* Social Media Links */}
                <div className="space-y-4">
                  <h4 className="font-medium">Social Media</h4>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="shop-facebook">Facebook</Label>
                      <Input
                        id="shop-facebook"
                        placeholder="https://facebook.com/yourshop"
                        value={shopFacebook}
                        onChange={(e) => setShopFacebook(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shop-instagram">Instagram</Label>
                      <Input
                        id="shop-instagram"
                        placeholder="https://instagram.com/yourshop"
                        value={shopInstagram}
                        onChange={(e) => setShopInstagram(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shop-twitter">Twitter/X</Label>
                      <Input
                        id="shop-twitter"
                        placeholder="https://twitter.com/yourshop"
                        value={shopTwitter}
                        onChange={(e) => setShopTwitter(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Add your social media profiles to help customers connect with you
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Inventory Settings */}
            <Card data-testid="settings-inventory">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Package className="w-5 h-5 mr-2 text-red-600" />
                  Inventory Management
                </CardTitle>
                <CardDescription>Configure inventory tracking and alerts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="default-low-stock" data-testid="label-default-low-stock">Default Low Stock Threshold</Label>
                    <Input 
                      id="default-low-stock" 
                      type="number" 
                      placeholder="10" 
                      data-testid="input-default-low-stock"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="default-unit" data-testid="label-default-unit">Default Unit of Measurement</Label>
                    <Select defaultValue="pieces">
                      <SelectTrigger data-testid="select-default-unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pieces">Pieces</SelectItem>
                        <SelectItem value="kg">Kilograms</SelectItem>
                        <SelectItem value="lbs">Pounds</SelectItem>
                        <SelectItem value="liters">Liters</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <h4 className="font-medium">Inventory Alerts</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Switch id="low-stock-alerts" defaultChecked data-testid="switch-low-stock-alerts" />
                      <Label htmlFor="low-stock-alerts">Low Stock Alerts</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="out-of-stock-alerts" defaultChecked data-testid="switch-out-of-stock-alerts" />
                      <Label htmlFor="out-of-stock-alerts">Out of Stock Alerts</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="auto-reorder" data-testid="switch-auto-reorder" />
                      <Label htmlFor="auto-reorder">Automatic Reorder Suggestions</Label>
                      <Badge variant="secondary">Premium</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Accounting Settings */}
            <Card data-testid="settings-accounting">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="w-5 h-5 mr-2 text-red-600" />
                  Accounting Integration
                </CardTitle>
                <CardDescription>Configure financial tracking and reporting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="currency" data-testid="label-currency">Default Currency</Label>
                    <Select defaultValue="usd">
                      <SelectTrigger data-testid="select-currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="usd">USD - US Dollar</SelectItem>
                        <SelectItem value="eur">EUR - Euro</SelectItem>
                        <SelectItem value="gbp">GBP - British Pound</SelectItem>
                        <SelectItem value="cad">CAD - Canadian Dollar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax-rate" data-testid="label-tax-rate">Default Tax Rate (%)</Label>
                    <Input 
                      id="tax-rate" 
                      type="number" 
                      placeholder="8.25" 
                      step="0.01"
                      data-testid="input-tax-rate"
                    />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-medium">Financial Tracking</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Switch id="auto-cost-tracking" defaultChecked data-testid="switch-auto-cost-tracking" />
                      <Label htmlFor="auto-cost-tracking">Automatic Cost Tracking</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="profit-margin-calc" defaultChecked data-testid="switch-profit-margin-calc" />
                      <Label htmlFor="profit-margin-calc">Profit Margin Calculation</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notification Settings */}
            <Card data-testid="settings-notifications">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="w-5 h-5 mr-2 text-red-600" />
                  Notifications
                </CardTitle>
                <CardDescription>Manage how and when you receive alerts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="notification-email" data-testid="label-notification-email">Notification Email</Label>
                  <Input 
                    id="notification-email" 
                    type="email" 
                    placeholder="admin@company.com" 
                    data-testid="input-notification-email"
                  />
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-medium">Email Notifications</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Switch id="email-low-stock" defaultChecked data-testid="switch-email-low-stock" />
                      <Label htmlFor="email-low-stock">Low Stock Alerts</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="email-daily-reports" data-testid="switch-email-daily-reports" />
                      <Label htmlFor="email-daily-reports">Daily Reports</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="email-weekly-summary" defaultChecked data-testid="switch-email-weekly-summary" />
                      <Label htmlFor="email-weekly-summary">Weekly Summary</Label>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-medium">In-App Notifications</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Switch id="app-sound" defaultChecked data-testid="switch-app-sound" />
                      <Label htmlFor="app-sound">Sound Notifications</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="app-desktop" defaultChecked data-testid="switch-app-desktop" />
                      <Label htmlFor="app-desktop">Desktop Notifications</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security Settings */}
            <Card data-testid="settings-security">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-red-600" />
                  Security & Privacy
                </CardTitle>
                <CardDescription>Manage security settings and data privacy</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <h4 className="font-medium">Session Management</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="session-timeout" data-testid="label-session-timeout">Session Timeout (minutes)</Label>
                      <Select defaultValue="60">
                        <SelectTrigger data-testid="select-session-timeout">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="60">1 hour</SelectItem>
                          <SelectItem value="120">2 hours</SelectItem>
                          <SelectItem value="480">8 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2 pt-6">
                      <Switch id="remember-login" data-testid="switch-remember-login" />
                      <Label htmlFor="remember-login">Remember Login</Label>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <h4 className="font-medium">Data Privacy</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Switch id="analytics-tracking" defaultChecked data-testid="switch-analytics-tracking" />
                      <Label htmlFor="analytics-tracking">Analytics Tracking</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="error-reporting" defaultChecked data-testid="switch-error-reporting" />
                      <Label htmlFor="error-reporting">Error Reporting</Label>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <div>
                      <h5 className="font-medium text-yellow-800 dark:text-yellow-200">Data Backup</h5>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Regular backups are automatically created. You can export your data anytime.
                      </p>
                      <Button variant="outline" size="sm" className="mt-2" data-testid="button-export-data">
                        Export Data
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Database Settings */}
            <Card data-testid="settings-database">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="w-5 h-5 mr-2 text-red-600" />
                  Database Management
                </CardTitle>
                <CardDescription>Database maintenance and optimization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-4 border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-green-800 dark:text-green-200">Database Status</h4>
                        <p className="text-sm text-green-600 dark:text-green-400">Connected & Healthy</p>
                      </div>
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    </div>
                  </Card>
                  
                  <Card className="p-4 border-blue-200 dark:border-blue-800">
                    <div>
                      <h4 className="font-medium text-blue-800 dark:text-blue-200">Last Backup</h4>
                      <p className="text-sm text-blue-600 dark:text-blue-400">2 hours ago</p>
                      <p className="text-xs text-blue-500 dark:text-blue-500">Next: Tonight at 2:00 AM</p>
                    </div>
                  </Card>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">Database Actions</h4>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" data-testid="button-optimize-db">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Optimize Database
                    </Button>
                    <Button variant="outline" size="sm" data-testid="button-backup-now">
                      <Database className="w-4 h-4 mr-2" />
                      Backup Now
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      </main>
    </div>
  );
}