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
  Settings,  User, Bell, Shield,  Database,  Mail,  Palette,  Package,  DollarSign,AlertTriangle, Save, RefreshCw, Clock} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

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

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem(`settings_${user?.uid}`);
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setCompanyName(settings.companyName || "");
      setTimezone(settings.timezone || "UTC");
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

  // Save settings
  const handleSaveSettings = async () => {
    setIsSaving(true);
    const settings = {
      companyName,
      timezone,
      updatedAt: new Date().toISOString(),
    };
    
    // Save to localStorage
    localStorage.setItem(`settings_${user?.uid}`, JSON.stringify(settings));
    
    // Also save companyName to Firestore user document
    try {
      if (user?.uid) {
        const response = await fetch(`/api/users/${user.uid}/settings`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ companyName, timezone }),
        });
        
        if (!response.ok) {
          console.error('Failed to save settings to server');
        }
      }
    } catch (error) {
      console.error('Error saving settings to server:', error);
    }
    
    setTimeout(() => {
      setIsSaving(false);
      toast({
        title: "Settings Saved",
        description: "Your settings have been updated successfully.",
      });
    }, 500);
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