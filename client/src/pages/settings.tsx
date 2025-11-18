import { useState, useEffect, useRef } from "react";
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
  Settings,  User, Bell,  Mail,  Package,  DollarSign, Save, Clock, Store, Upload, Image as ImageIcon} from "lucide-react";
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
  const [activeSection, setActiveSection] = useState<"general" | "shop" | "inventory" | "accounting" | "notifications">("general");
  const sections = {
    general: useRef<HTMLDivElement | null>(null),
    shop: useRef<HTMLDivElement | null>(null),
    inventory: useRef<HTMLDivElement | null>(null),
    accounting: useRef<HTMLDivElement | null>(null),
    notifications: useRef<HTMLDivElement | null>(null),
  } as const;
  
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

  // Inventory & Accounting States
  const [defaultLowStock, setDefaultLowStock] = useState<number>(10);
  const [defaultUnit, setDefaultUnit] = useState<string>("pieces");
  const [currency, setCurrency] = useState<string>("usd");

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
      setDefaultLowStock(typeof settings.defaultLowStock === "number" ? settings.defaultLowStock : 10);
      setDefaultUnit(settings.defaultUnit || "pieces");
      setCurrency(settings.currency || "usd");
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
      defaultLowStock,
      defaultUnit,
      currency,
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
    // Also save global app preferences for viewers/non-auth contexts
    localStorage.setItem('app_currency', currency);
    localStorage.setItem('app_defaultUnit', defaultUnit);
    localStorage.setItem('app_defaultLowStock', String(defaultLowStock));
    
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

  // Sticky menu active section tracking
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.boundingClientRect.top > b.boundingClientRect.top ? 1 : -1));
        if (visible.length > 0) {
          const id = visible[0].target.getAttribute("data-section-id") as typeof activeSection | null;
          if (id && id !== activeSection) setActiveSection(id);
        }
      },
      { root: null, rootMargin: "-100px 0px -60% 0px", threshold: 0.1 }
    );

    const nodes = [
      sections.general.current,
      sections.shop.current,
      sections.inventory.current,
      sections.accounting.current,
      sections.notifications.current,
    ].filter(Boolean) as HTMLElement[];

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [sections.general, sections.shop, sections.inventory, sections.accounting, sections.notifications, activeSection]);

  const scrollTo = (key: keyof typeof sections) => {
    const el = sections[key].current;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
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
            <Card data-testid="settings-navigation" className="sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-red-600" />
                  Settings Menu
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant={activeSection === 'general' ? 'secondary' : 'ghost'} 
                  className="w-full justify-start" 
                  data-testid="nav-general"
                  onClick={() => scrollTo('general')}
                >
                  <User className="w-4 h-4 mr-2" />
                  General
                </Button>
                <Button 
                  variant={activeSection === 'inventory' ? 'secondary' : 'ghost'} 
                  className="w-full justify-start" 
                  data-testid="nav-inventory"
                  onClick={() => scrollTo('inventory')}
                >
                  <Package className="w-4 h-4 mr-2" />
                  Inventory
                </Button>
                <Button 
                  variant={activeSection === 'accounting' ? 'secondary' : 'ghost'} 
                  className="w-full justify-start" 
                  data-testid="nav-accounting"
                  onClick={() => scrollTo('accounting')}
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Accounting
                </Button>
                <Button 
                  variant={activeSection === 'notifications' ? 'secondary' : 'ghost'} 
                  className="w-full justify-start" 
                  data-testid="nav-notifications"
                  onClick={() => scrollTo('notifications')}
                >
                  <Bell className="w-4 h-4 mr-2" />
                  Notifications
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Settings Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* General Settings */}
            <Card data-testid="settings-general" ref={sections.general} data-section-id="general">
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
            <Card data-testid="settings-shop-profile" ref={sections.shop} data-section-id="shop">
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
            <Card data-testid="settings-inventory" ref={sections.inventory} data-section-id="inventory">
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
                      value={defaultLowStock}
                      onChange={(e) => setDefaultLowStock(Number(e.target.value))}
                      data-testid="input-default-low-stock"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="default-unit" data-testid="label-default-unit">Default Unit of Measurement</Label>
                    <Select value={defaultUnit} onValueChange={setDefaultUnit}>
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
                    {null}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Accounting Settings */}
            <Card data-testid="settings-accounting" ref={sections.accounting} data-section-id="accounting">
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
                    <Select value={currency} onValueChange={setCurrency}>
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
            <Card data-testid="settings-notifications" ref={sections.notifications} data-section-id="notifications">
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

            {null}
          </div>
        </div>
      </div>
      </main>
    </div>
  );
}