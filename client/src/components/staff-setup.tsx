import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { UserCog, Shield, MapPin, Key, Loader2, Edit, Trash2, Check } from "lucide-react";

interface Branch {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  contactNumber?: string;
  isActive?: boolean;
}

interface StaffProfile {
  id: string;
  staffName: string;
  role: string;
  branchId?: string;
}

export default function StaffSetup() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [editBranchDialog, setEditBranchDialog] = useState(false);
  const [deleteBranchDialog, setDeleteBranchDialog] = useState(false);
  const [deleteStaffDialog, setDeleteStaffDialog] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);

  const [setupForm, setSetupForm] = useState({
    staffName: "",
    role: "staff",
    branchId: "",
    staffPin: "",
    confirmPin: "",
  });

  const [pinForm, setPinForm] = useState({
    currentPin: "",
    newPin: "",
    confirmPin: "",
  });

  const [newBranchForm, setNewBranchForm] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    contactNumber: "",
  });

  const [editBranchForm, setEditBranchForm] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    contactNumber: "",
  });

  // Fetch current user's staff profile
  const { data: staffProfile, refetch: refetchStaff } = useQuery<StaffProfile | null>({
    queryKey: ["staff", "profile"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/staff/profile");
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error("Failed to fetch staff profile");
      }
      return response.json();
    },
    enabled: isAuthenticated,
  });

  // Fetch all staff members
  const { data: allStaff = [], refetch: refetchAllStaff } = useQuery<StaffProfile[]>({
    queryKey: ["staff", "all"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/staff");
      if (!response.ok) throw new Error("Failed to fetch staff members");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  // Fetch branches
  const { data: branches = [], refetch: refetchBranches } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/branches");
      if (!response.ok) throw new Error("Failed to fetch branches");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  // Create staff mutation
  const createStaffMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/staff", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create staff profile");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Staff profile created successfully",
      });
      setSetupDialogOpen(false);
      setSetupForm({
        staffName: "",
        role: "staff",
        branchId: "",
        staffPin: "",
        confirmPin: "",
      });
      refetchStaff();
      refetchAllStaff();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update PIN mutation
  const updatePinMutation = useMutation({
    mutationFn: async (data: { staffId: string; currentPin: string; newPin: string }) => {
      const response = await apiRequest("PUT", `/api/staff/${data.staffId}/pin`, {
        currentPin: data.currentPin,
        newPin: data.newPin,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update PIN");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "PIN updated successfully",
      });
      setPinDialogOpen(false);
      setPinForm({
        currentPin: "",
        newPin: "",
        confirmPin: "",
      });
      setSelectedStaff(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create branch mutation
  const createBranchMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/branches", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create branch");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Branch created successfully",
      });
      setBranchDialogOpen(false);
      setNewBranchForm({
        name: "",
        address: "",
        city: "",
        state: "",
        postalCode: "",
        contactNumber: "",
      });
      refetchBranches();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete staff mutation
  const deleteStaffMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/staff/${id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete staff");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Staff deleted successfully",
      });
      setDeleteStaffDialog(false);
      setSelectedStaff(null);
      refetchAllStaff();
      refetchStaff();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update branch mutation
  const updateBranchMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PUT", `/api/branches/${id}`, data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update branch");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Branch updated successfully",
      });
      setEditBranchDialog(false);
      setSelectedBranch(null);
      refetchBranches();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete branch mutation
  const deleteBranchMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/branches/${id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete branch");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Branch deleted successfully",
      });
      setDeleteBranchDialog(false);
      setSelectedBranch(null);
      refetchBranches();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Set current branch mutation
  const setCurrentBranchMutation = useMutation({
    mutationFn: async (branchId: string) => {
      const response = await apiRequest("PUT", "/api/staff/current-branch", { branchId });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to set current branch");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Current branch updated successfully",
      });
      refetchStaff();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateStaff = () => {
    if (!setupForm.staffName.trim()) {
      toast({
        title: "Error",
        description: "Please enter staff name",
        variant: "destructive",
      });
      return;
    }

    if (setupForm.staffPin.length !== 6) {
      toast({
        title: "Error",
        description: "PIN must be 6 digits",
        variant: "destructive",
      });
      return;
    }

    if (setupForm.staffPin !== setupForm.confirmPin) {
      toast({
        title: "Error",
        description: "PINs do not match",
        variant: "destructive",
      });
      return;
    }

    createStaffMutation.mutate({
      staffName: setupForm.staffName,
      role: setupForm.role,
      branchId: setupForm.branchId || null,
      staffPin: setupForm.staffPin,
    });
  };

  const handleUpdatePin = () => {
    if (!selectedStaff) {
      toast({
        title: "Error",
        description: "No staff member selected",
        variant: "destructive",
      });
      return;
    }

    if (pinForm.newPin.length !== 6) {
      toast({
        title: "Error",
        description: "New PIN must be 6 digits",
        variant: "destructive",
      });
      return;
    }

    if (pinForm.newPin !== pinForm.confirmPin) {
      toast({
        title: "Error",
        description: "New PINs do not match",
        variant: "destructive",
      });
      return;
    }

    updatePinMutation.mutate({
      staffId: selectedStaff.id,
      currentPin: pinForm.currentPin,
      newPin: pinForm.newPin,
    });
  };

  const handleCreateBranch = () => {
    if (!newBranchForm.name.trim()) {
      toast({
        title: "Error",
        description: "Please enter branch name",
        variant: "destructive",
      });
      return;
    }

    createBranchMutation.mutate(newBranchForm);
  };

  const handleEditBranch = () => {
    if (!selectedBranch) return;

    if (!editBranchForm.name.trim()) {
      toast({
        title: "Error",
        description: "Please enter branch name",
        variant: "destructive",
      });
      return;
    }

    updateBranchMutation.mutate({
      id: selectedBranch.id,
      data: editBranchForm,
    });
  };

  const handleDeleteBranch = () => {
    if (!selectedBranch) return;
    deleteBranchMutation.mutate(selectedBranch.id);
  };

  const handleDeleteStaff = () => {
    if (!selectedStaff) return;
    deleteStaffMutation.mutate(selectedStaff.id);
  };

  const openEditBranchDialog = (branch: Branch) => {
    setSelectedBranch(branch);
    setEditBranchForm({
      name: branch.name,
      address: branch.address || "",
      city: branch.city || "",
      state: branch.state || "",
      postalCode: branch.postalCode || "",
      contactNumber: branch.contactNumber || "",
    });
    setEditBranchDialog(true);
  };

  const openDeleteBranchDialog = (branch: Branch) => {
    setSelectedBranch(branch);
    setDeleteBranchDialog(true);
  };

  const openDeleteStaffDialog = (staff: StaffProfile) => {
    setSelectedStaff(staff);
    setDeleteStaffDialog(true);
  };

  const getBranchName = (branchId?: string) => {
    if (!branchId) return "Not assigned";
    const branch = branches.find((b) => b.id === branchId);
    return branch?.name || "Unknown";
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-red-500">Admin</Badge>;
      case "manager":
        return <Badge className="bg-blue-500">Manager</Badge>;
      case "staff":
        return <Badge className="bg-green-500">Staff</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Staff Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserCog size={20} />
                Staff Members
              </CardTitle>
              <CardDescription>
                Manage staff profiles for branch transfer features
              </CardDescription>
            </div>
            <Button onClick={() => setSetupDialogOpen(true)}>
              <UserCog className="w-4 h-4 mr-2" />
              Add Staff
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {allStaff.map((staff) => (
              <div
                key={staff.id}
                className="flex items-center justify-between p-4 bg-muted rounded-lg"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{staff.staffName}</h3>
                    {getRoleBadge(staff.role)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin size={16} />
                    <span>{getBranchName(staff.branchId)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedStaff(staff);
                      setPinDialogOpen(true);
                    }}
                  >
                    <Key className="w-4 h-4 mr-2" />
                    Change PIN
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openDeleteStaffDialog(staff)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {allStaff.length === 0 && (
              <div className="text-center py-8">
                <UserCog className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Staff Members</h3>
                <p className="text-muted-foreground mb-4">
                  Add staff members to enable branch transfer features
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Branches Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin size={20} />
                Branches
              </CardTitle>
              <CardDescription>Manage your branch locations</CardDescription>
            </div>
            <Button onClick={() => setBranchDialogOpen(true)} size="sm">
              Add Branch
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {branches.map((branch) => (
              <div
                key={branch.id}
                className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{branch.name}</h4>
                      {staffProfile?.branchId === branch.id && (
                        <Badge variant="default" className="flex items-center gap-1">
                          <Check size={12} />
                          Current
                        </Badge>
                      )}
                    </div>
                    {branch.address && (
                      <p className="text-sm text-muted-foreground">
                        {branch.address}
                        {branch.city && `, ${branch.city}`}
                        {branch.state && `, ${branch.state}`}
                      </p>
                    )}
                    {branch.contactNumber && (
                      <p className="text-sm text-muted-foreground">
                        📞 {branch.contactNumber}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {staffProfile && staffProfile.branchId !== branch.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCurrentBranchMutation.mutate(branch.id)}
                        disabled={setCurrentBranchMutation.isPending}
                      >
                        Set Current
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditBranchDialog(branch)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openDeleteBranchDialog(branch)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {branches.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">
                No branches found. Add your first branch to get started.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Setup Staff Dialog */}
      <Dialog open={setupDialogOpen} onOpenChange={setSetupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Up Staff Profile</DialogTitle>
            <DialogDescription>
              Create your staff profile to use branch transfer features
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Staff Name</Label>
              <Input
                value={setupForm.staffName}
                onChange={(e) =>
                  setSetupForm({ ...setupForm, staffName: e.target.value })
                }
                placeholder="Enter your name"
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select
                value={setupForm.role}
                onValueChange={(value) =>
                  setSetupForm({ ...setupForm, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Branch (Optional)</Label>
              <Select
                value={setupForm.branchId}
                onValueChange={(value) =>
                  setSetupForm({ ...setupForm, branchId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>6-Digit PIN</Label>
              <Input
                type="password"
                maxLength={6}
                value={setupForm.staffPin}
                onChange={(e) =>
                  setSetupForm({
                    ...setupForm,
                    staffPin: e.target.value.replace(/\D/g, ""),
                  })
                }
                placeholder="Enter 6-digit PIN"
              />
            </div>
            <div>
              <Label>Confirm PIN</Label>
              <Input
                type="password"
                maxLength={6}
                value={setupForm.confirmPin}
                onChange={(e) =>
                  setSetupForm({
                    ...setupForm,
                    confirmPin: e.target.value.replace(/\D/g, ""),
                  })
                }
                placeholder="Confirm PIN"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSetupDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateStaff}
              disabled={createStaffMutation.isPending}
            >
              {createStaffMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Create Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update PIN Dialog */}
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change PIN</DialogTitle>
            <DialogDescription>
              Update PIN for {selectedStaff?.staffName || "staff member"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Current PIN</Label>
              <Input
                type="password"
                maxLength={6}
                value={pinForm.currentPin}
                onChange={(e) =>
                  setPinForm({
                    ...pinForm,
                    currentPin: e.target.value.replace(/\D/g, ""),
                  })
                }
                placeholder="Enter current PIN"
              />
            </div>
            <div>
              <Label>New PIN</Label>
              <Input
                type="password"
                maxLength={6}
                value={pinForm.newPin}
                onChange={(e) =>
                  setPinForm({
                    ...pinForm,
                    newPin: e.target.value.replace(/\D/g, ""),
                  })
                }
                placeholder="Enter new 6-digit PIN"
              />
            </div>
            <div>
              <Label>Confirm New PIN</Label>
              <Input
                type="password"
                maxLength={6}
                value={pinForm.confirmPin}
                onChange={(e) =>
                  setPinForm({
                    ...pinForm,
                    confirmPin: e.target.value.replace(/\D/g, ""),
                  })
                }
                placeholder="Confirm new PIN"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdatePin}
              disabled={updatePinMutation.isPending}
            >
              {updatePinMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Update PIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Branch Dialog */}
      <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Branch</DialogTitle>
            <DialogDescription>
              Create a new branch location for transfers
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Branch Name *</Label>
              <Input
                value={newBranchForm.name}
                onChange={(e) =>
                  setNewBranchForm({ ...newBranchForm, name: e.target.value })
                }
                placeholder="e.g., Main Store, Warehouse A"
              />
            </div>
            <div>
              <Label>Address</Label>
              <Input
                value={newBranchForm.address}
                onChange={(e) =>
                  setNewBranchForm({
                    ...newBranchForm,
                    address: e.target.value,
                  })
                }
                placeholder="Street address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>City</Label>
                <Input
                  value={newBranchForm.city}
                  onChange={(e) =>
                    setNewBranchForm({ ...newBranchForm, city: e.target.value })
                  }
                  placeholder="City"
                />
              </div>
              <div>
                <Label>State</Label>
                <Input
                  value={newBranchForm.state}
                  onChange={(e) =>
                    setNewBranchForm({ ...newBranchForm, state: e.target.value })
                  }
                  placeholder="State"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Postal Code</Label>
                <Input
                  value={newBranchForm.postalCode}
                  onChange={(e) =>
                    setNewBranchForm({
                      ...newBranchForm,
                      postalCode: e.target.value,
                    })
                  }
                  placeholder="Postal code"
                />
              </div>
              <div>
                <Label>Contact Number</Label>
                <Input
                  value={newBranchForm.contactNumber}
                  onChange={(e) =>
                    setNewBranchForm({
                      ...newBranchForm,
                      contactNumber: e.target.value,
                    })
                  }
                  placeholder="Phone number"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBranchDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateBranch}
              disabled={createBranchMutation.isPending}
            >
              {createBranchMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Create Branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Staff Dialog */}
      <AlertDialog open={deleteStaffDialog} onOpenChange={setDeleteStaffDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Staff Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedStaff?.staffName}"? This action cannot be undone.
              This will remove the staff member and their access to the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStaff}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleteStaffMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Branch Dialog */}
      <Dialog open={editBranchDialog} onOpenChange={setEditBranchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Branch</DialogTitle>
            <DialogDescription>
              Update branch information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Branch Name *</Label>
              <Input
                value={editBranchForm.name}
                onChange={(e) =>
                  setEditBranchForm({ ...editBranchForm, name: e.target.value })
                }
                placeholder="Enter branch name"
              />
            </div>
            <div>
              <Label>Address</Label>
              <Input
                value={editBranchForm.address}
                onChange={(e) =>
                  setEditBranchForm({ ...editBranchForm, address: e.target.value })
                }
                placeholder="Street address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>City</Label>
                <Input
                  value={editBranchForm.city}
                  onChange={(e) =>
                    setEditBranchForm({ ...editBranchForm, city: e.target.value })
                  }
                  placeholder="City"
                />
              </div>
              <div>
                <Label>State</Label>
                <Input
                  value={editBranchForm.state}
                  onChange={(e) =>
                    setEditBranchForm({ ...editBranchForm, state: e.target.value })
                  }
                  placeholder="State"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Postal Code</Label>
                <Input
                  value={editBranchForm.postalCode}
                  onChange={(e) =>
                    setEditBranchForm({
                      ...editBranchForm,
                      postalCode: e.target.value,
                    })
                  }
                  placeholder="Postal code"
                />
              </div>
              <div>
                <Label>Contact Number</Label>
                <Input
                  value={editBranchForm.contactNumber}
                  onChange={(e) =>
                    setEditBranchForm({
                      ...editBranchForm,
                      contactNumber: e.target.value,
                    })
                  }
                  placeholder="Phone number"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditBranchDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditBranch}
              disabled={updateBranchMutation.isPending}
            >
              {updateBranchMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Branch Dialog */}
      <AlertDialog open={deleteBranchDialog} onOpenChange={setDeleteBranchDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Branch</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedBranch?.name}"? This action cannot be undone.
              This will not delete products, but will remove the branch assignment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBranch}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleteBranchMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
