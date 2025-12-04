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
  Settings,  User, Bell,  Mail,  Package,  DollarSign, Save, Clock, Store, Upload, Image as ImageIcon, Trash2, Building2, Users, Key, Plus, Copy, RefreshCw, Pencil} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [activeSection, setActiveSection] = useState<"general" | "branch" | "staff" | "shop" | "inventory" | "accounting" | "notifications">("general");
  const sections = {
    general: useRef<HTMLDivElement | null>(null),
    branch: useRef<HTMLDivElement | null>(null),
    staff: useRef<HTMLDivElement | null>(null),
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

  // Email Notification States
  const [notificationEmail, setNotificationEmail] = useState<string>("");
  const [emailDailyReports, setEmailDailyReports] = useState<boolean>(false);
  const [emailWeeklySummary, setEmailWeeklySummary] = useState<boolean>(true);

  // Delete Account Data States
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Branch Management States
  const [currentBranch, setCurrentBranch] = useState<string>("Warehouse A");
  const [branches, setBranches] = useState<string[]>(["Warehouse A"]);
  const [newBranchName, setNewBranchName] = useState("");
  const [isAddingBranch, setIsAddingBranch] = useState(false);

  // Staff Management States
  interface Staff {
    id: string;
    name: string;
    pin: string;
    branch: string;
    createdAt: string;
  }
  const [staff, setStaff] = useState<Staff[]>([]);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffBranch, setNewStaffBranch] = useState("");
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [editStaffBranch, setEditStaffBranch] = useState("");

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
      // Load email notification settings
      setNotificationEmail(settings.notificationEmail || user?.email || "");
      setEmailDailyReports(settings.emailDailyReports !== undefined ? settings.emailDailyReports : false);
      setEmailWeeklySummary(settings.emailWeeklySummary !== undefined ? settings.emailWeeklySummary : true);
      // Load branch settings
      setCurrentBranch(settings.currentBranch || "Warehouse A");
      setBranches(settings.branches || ["Warehouse A"]);
      // Load staff settings
      setStaff(settings.staff || []);
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

  // Generate 6-digit PIN for staff
  const generatePin = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // Handle current branch change with auto-save
  const handleCurrentBranchChange = (value: string) => {
    setCurrentBranch(value);
    localStorage.setItem('app_currentBranch', value);
  };

  // Add new branch
  const handleAddBranch = () => {
    if (!newBranchName.trim()) {
      toast({
        title: "Invalid Branch Name",
        description: "Please enter a branch name.",
        variant: "destructive",
      });
      return;
    }
    if (branches.includes(newBranchName.trim())) {
      toast({
        title: "Branch Exists",
        description: "This branch name already exists.",
        variant: "destructive",
      });
      return;
    }
    const updatedBranches = [...branches, newBranchName.trim()];
    setBranches(updatedBranches);
    setNewBranchName("");
    setIsAddingBranch(false);
    
    // Auto-save to localStorage for public scan page access
    localStorage.setItem('app_branches', JSON.stringify(updatedBranches));
    
    toast({
      title: "Branch Added",
      description: `Branch "${newBranchName.trim()}" has been added.`,
    });
  };

  // Delete branch
  const handleDeleteBranch = (branchToDelete: string) => {
    if (branches.length <= 1) {
      toast({
        title: "Cannot Delete",
        description: "You must have at least one branch.",
        variant: "destructive",
      });
      return;
    }
    if (currentBranch === branchToDelete) {
      toast({
        title: "Cannot Delete",
        description: "Cannot delete the current branch. Switch to another branch first.",
        variant: "destructive",
      });
      return;
    }
    const updatedBranches = branches.filter(b => b !== branchToDelete);
    setBranches(updatedBranches);
    
    // Auto-save to localStorage
    localStorage.setItem('app_branches', JSON.stringify(updatedBranches));
    
    toast({
      title: "Branch Deleted",
      description: `Branch "${branchToDelete}" has been removed.`,
    });
  };

  // Add new staff
  const handleAddStaff = () => {
    if (!newStaffName.trim()) {
      toast({
        title: "Invalid Staff Name",
        description: "Please enter a staff name.",
        variant: "destructive",
      });
      return;
    }
    if (!newStaffBranch) {
      toast({
        title: "Select Branch",
        description: "Please select a branch for this staff member.",
        variant: "destructive",
      });
      return;
    }
    const newStaff: Staff = {
      id: `staff_${Date.now()}`,
      name: newStaffName.trim(),
      pin: generatePin(),
      branch: newStaffBranch,
      createdAt: new Date().toISOString(),
    };
    const updatedStaff = [...staff, newStaff];
    setStaff(updatedStaff);
    setNewStaffName("");
    setNewStaffBranch("");
    setIsAddingStaff(false);
    
    // Auto-save staff to localStorage immediately for public scan page access
    localStorage.setItem('app_staff', JSON.stringify(updatedStaff));
    console.log('Auto-saved staff to localStorage:', updatedStaff);
    
    toast({
      title: "Staff Added",
      description: `Staff "${newStaffName.trim()}" (${newStaffBranch}) has been added with PIN: ${newStaff.pin}`,
    });
  };

  // Delete staff
  const handleDeleteStaff = (staffId: string) => {
    const updatedStaff = staff.filter(s => s.id !== staffId);
    setStaff(updatedStaff);
    
    // Auto-save to localStorage
    localStorage.setItem('app_staff', JSON.stringify(updatedStaff));
    
    toast({
      title: "Staff Deleted",
      description: "Staff member has been removed.",
    });
  };

  // Edit staff branch
  const handleEditStaffBranch = () => {
    if (!editingStaff || !editStaffBranch) return;
    
    const updatedStaff = staff.map(s => 
      s.id === editingStaff.id ? { ...s, branch: editStaffBranch } : s
    );
    setStaff(updatedStaff);
    
    // Auto-save to localStorage
    localStorage.setItem('app_staff', JSON.stringify(updatedStaff));
    
    toast({
      title: "Staff Updated",
      description: `${editingStaff.name}'s branch has been updated to ${editStaffBranch}.`,
    });
    
    setEditingStaff(null);
    setEditStaffBranch("");
  };

  // Regenerate staff PIN
  const handleRegeneratePin = (staffId: string) => {
    const newPin = generatePin();
    const updatedStaff = staff.map(s => s.id === staffId ? { ...s, pin: newPin } : s);
    setStaff(updatedStaff);
    
    // Auto-save to localStorage
    localStorage.setItem('app_staff', JSON.stringify(updatedStaff));
    
    toast({
      title: "PIN Regenerated",
      description: `New PIN: ${newPin}`,
    });
  };

  // Copy PIN to clipboard
  const handleCopyPin = (pin: string) => {
    navigator.clipboard.writeText(pin);
    toast({
      title: "PIN Copied",
      description: "PIN has been copied to clipboard.",
    });
  };

  const handleDeleteAccountData = async () => {
    if (deleteConfirmation !== "DELETEDATA") {
      toast({
        title: "Invalid Confirmation",
        description: "Please type DELETEDATA exactly as shown.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      await apiRequest("DELETE", `/api/users/${user?.uid}/data`);
      
      toast({
        title: "Account Data Deleted",
        description: "All your data has been permanently deleted. Your account has been reset.",
      });
      
      localStorage.removeItem(`settings_${user?.uid}`);
      
      setCompanyName("");
      setShopSlug("");
      setShopDescription("");
      setShopBannerUrl("");
      setShopLogoUrl("");
      setShopEmail("");
      setShopPhone("");
      setShopAddress("");
      setShopWebsite("");
      setShopFacebook("");
      setShopInstagram("");
      setShopTwitter("");
      setDefaultLowStock(10);
      setDefaultUnit("pieces");
      setCurrency("usd");
      setNotificationEmail(user?.email || "");
      
      setShowDeleteDialog(false);
      setDeleteConfirmation("");
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error("Error deleting account data:", error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete account data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

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
      notificationEmail,
      emailDailyReports,
      emailWeeklySummary,
      currentBranch,
      branches,
      staff,
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
    localStorage.setItem('app_currentBranch', currentBranch);
    // Save branches and staff globally for public scan page access
    localStorage.setItem('app_branches', JSON.stringify(branches));
    localStorage.setItem('app_staff', JSON.stringify(staff));
    
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
      sections.branch.current,
      sections.staff.current,
      sections.shop.current,
      sections.inventory.current,
      sections.accounting.current,
      sections.notifications.current,
    ].filter(Boolean) as HTMLElement[];

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [sections.general, sections.branch, sections.staff, sections.shop, sections.inventory, sections.accounting, sections.notifications, activeSection]);

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Settings Navigation */}
          <div className="lg:col-span-1 sticky top-6">
            <Card data-testid="settings-navigation">
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
                  variant={activeSection === 'branch' ? 'secondary' : 'ghost'} 
                  className="w-full justify-start" 
                  data-testid="nav-branch"
                  onClick={() => scrollTo('branch')}
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  Branch Management
                </Button>
                <Button 
                  variant={activeSection === 'staff' ? 'secondary' : 'ghost'} 
                  className="w-full justify-start" 
                  data-testid="nav-staff"
                  onClick={() => scrollTo('staff')}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Staff Management
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

            {/* Branch Management Settings */}
            <Card data-testid="settings-branch" ref={sections.branch} data-section-id="branch">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building2 className="w-5 h-5 mr-2 text-red-600" />
                  Branch Management
                </CardTitle>
                <CardDescription>Manage your warehouse branches and set current location</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Current Branch Selection */}
                <div className="space-y-2">
                  <Label htmlFor="current-branch">Current Branch</Label>
                  <Select value={currentBranch} onValueChange={handleCurrentBranchChange}>
                    <SelectTrigger data-testid="select-current-branch">
                      <SelectValue placeholder="Select your current branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch} value={branch}>
                          {branch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Products added will be assigned to this branch by default.
                  </p>
                </div>

                <Separator />

                {/* Branch List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">All Branches</h4>
                    {!isAddingBranch && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAddingBranch(true)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Branch
                      </Button>
                    )}
                  </div>

                  {isAddingBranch && (
                    <div className="flex gap-2 p-3 border rounded-lg bg-muted/50">
                      <Input
                        placeholder="Enter branch name"
                        value={newBranchName}
                        onChange={(e) => setNewBranchName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddBranch();
                          }
                          if (e.key === "Escape") {
                            setIsAddingBranch(false);
                            setNewBranchName("");
                          }
                        }}
                        autoFocus
                        className="flex-1"
                      />
                      <Button type="button" size="sm" onClick={handleAddBranch}>
                        Add
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsAddingBranch(false);
                          setNewBranchName("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}

                  <div className="space-y-2">
                    {branches.map((branch) => (
                      <div
                        key={branch}
                        className={`flex items-center justify-between p-3 border rounded-lg ${
                          currentBranch === branch ? 'border-red-500 bg-red-50' : 'bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-500" />
                          <span className="font-medium">{branch}</span>
                          {currentBranch === branch && (
                            <Badge variant="default" className="bg-red-600 text-xs">Current</Badge>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteBranch(branch)}
                          disabled={branches.length <= 1 || currentBranch === branch}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Staff Management Settings */}
            <Card data-testid="settings-staff" ref={sections.staff} data-section-id="staff">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2 text-red-600" />
                  Staff Management
                </CardTitle>
                <CardDescription>Manage staff members and their unique PINs for product transfers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add Staff */}
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Staff Members</h4>
                  {!isAddingStaff && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddingStaff(true)}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Staff
                    </Button>
                  )}
                </div>

                {isAddingStaff && (
                  <div className="p-3 border rounded-lg bg-muted/50 space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter staff name"
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddStaff();
                          }
                          if (e.key === "Escape") {
                            setIsAddingStaff(false);
                            setNewStaffName("");
                            setNewStaffBranch("");
                          }
                        }}
                        autoFocus
                        className="flex-1"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Select value={newStaffBranch} onValueChange={setNewStaffBranch}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select branch for this staff" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch} value={branch}>
                              {branch}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsAddingStaff(false);
                          setNewStaffName("");
                          setNewStaffBranch("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="button" size="sm" onClick={handleAddStaff}>
                        Add Staff
                      </Button>
                    </div>
                  </div>
                )}

                {/* Staff List */}
                {staff.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No staff members yet. Add staff to enable product transfers.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {staff.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 border rounded-lg bg-white"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                            <User className="w-5 h-5 text-red-600" />
                          </div>
                          <div>
                            <p className="font-medium">{member.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-xs">
                                <Building2 className="w-3 h-3 mr-1" />
                                {member.branch || 'No branch'}
                              </Badge>
                              <span>Added: {new Date(member.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-md">
                            <Key className="w-3 h-3 text-gray-500" />
                            <span className="font-mono font-bold text-lg tracking-wider">{member.pin}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyPin(member.pin)}
                            title="Copy PIN"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRegeneratePin(member.id)}
                            title="Regenerate PIN"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingStaff(member);
                              setEditStaffBranch(member.branch || "");
                            }}
                            title="Edit Branch"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteStaff(member.id)}
                            title="Delete Staff"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Staff PINs are used for product transfers. Each staff member needs to enter their 6-digit PIN when transferring or receiving products.
                  </p>
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
                        <SelectItem value="sgd">SGD - Singapore Dollar</SelectItem>
                        <SelectItem value="myr">MYR - Malaysian Ringgit</SelectItem>
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
                  <Mail className="w-5 h-5 mr-2 text-red-600" />
                  Email Notifications
                </CardTitle>
                <CardDescription>Configure email alerts and reports</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="notification-email" data-testid="label-notification-email">Notification Email</Label>
                  <Input 
                    id="notification-email" 
                    type="email" 
                    placeholder="admin@company.com" 
                    value={notificationEmail}
                    onChange={(e) => setNotificationEmail(e.target.value)}
                    data-testid="input-notification-email"
                  />
                  <p className="text-xs text-muted-foreground">
                    All email notifications will be sent to this address
                  </p>
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <h4 className="font-medium">Email Alerts</h4>
                  <div className="space-y-4">
                    <div className="flex items-start justify-between space-x-2">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <Switch 
                            id="email-daily-reports" 
                            checked={emailDailyReports}
                            onCheckedChange={setEmailDailyReports}
                            data-testid="switch-email-daily-reports" 
                          />
                          <Label htmlFor="email-daily-reports" className="font-medium">Daily Reports</Label>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6 mt-1">
                          Get a daily summary of sales, inventory changes, low stock alerts, and key metrics (sent at 9 AM)
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start justify-between space-x-2">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <Switch 
                            id="email-weekly-summary" 
                            checked={emailWeeklySummary}
                            onCheckedChange={setEmailWeeklySummary}
                            data-testid="switch-email-weekly-summary" 
                          />
                          <Label htmlFor="email-weekly-summary" className="font-medium">Weekly Summary</Label>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6 mt-1">
                          Receive comprehensive weekly business performance and low stock report (sent every Monday at 9 AM)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="flex items-center text-red-600">
                  <Trash2 className="w-5 h-5 mr-2" />
                  Danger Zone
                </CardTitle>
                <CardDescription>Irreversible actions that will permanently delete your data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-red-300 bg-white p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-900">Delete All Account Data</h4>
                      <p className="text-sm text-red-700 mt-1">
                        This will permanently delete:
                      </p>
                      <ul className="text-sm text-red-600 mt-2 ml-4 list-disc space-y-1">
                        <li>All product inventory</li>
                        <li>All order history (current and past orders)</li>
                        <li>All accounting entries and financial records</li>
                        <li>All reports and analytics data</li>
                        <li>All QR codes</li>
                        <li>Shop profile and settings</li>
                      </ul>
                      <p className="text-sm text-red-800 mt-3 font-medium">
                        ⚠️ This action cannot be undone. Your account will be reset to a fresh state.
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={() => setShowDeleteDialog(true)}
                      className="ml-4"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete All Data
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {null}
          </div>
        </div>
      </div>
      </main>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This action will permanently delete all your data including:
              </p>
              <ul className="list-disc ml-6 space-y-1">
                <li>All products and inventory</li>
                <li>All orders (current and history)</li>
                <li>All accounting entries</li>
                <li>All reports and QR codes</li>
                <li>Shop profile and settings</li>
              </ul>
              <p className="font-semibold text-red-600">
                This action cannot be undone!
              </p>
              <div className="mt-4">
                <Label htmlFor="delete-confirm" className="text-sm font-medium">
                  Type <span className="font-mono font-bold">DELETEDATA</span> to confirm:
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="Type DELETEDATA here"
                  className="mt-2"
                  disabled={isDeleting}
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setDeleteConfirmation("");
                setShowDeleteDialog(false);
              }}
              disabled={isDeleting}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccountData}
              disabled={deleteConfirmation !== "DELETEDATA" || isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete All Data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Staff Branch Dialog */}
      <Dialog open={!!editingStaff} onOpenChange={(open) => {
        if (!open) {
          setEditingStaff(null);
          setEditStaffBranch("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-blue-500" />
              Edit Staff Branch
            </DialogTitle>
            <DialogDescription>
              Change the branch assignment for {editingStaff?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Staff Name</Label>
              <Input value={editingStaff?.name || ""} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Current Branch</Label>
              <Input value={editingStaff?.branch || "No branch assigned"} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-staff-branch">New Branch</Label>
              <Select value={editStaffBranch} onValueChange={setEditStaffBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch} value={branch}>
                      {branch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditingStaff(null);
              setEditStaffBranch("");
            }}>
              Cancel
            </Button>
            <Button onClick={handleEditStaffBranch} disabled={!editStaffBranch}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}