import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Store, Loader2, ChevronRight } from "lucide-react";

interface SearchShopsProps {
  searchQuery: string;
}

interface Shop {
  id: string;
  companyName: string;
  email: string;
  shopSlug: string;
  shopDescription?: string;
  shopLogoUrl?: string;
}

export default function SearchShops({ searchQuery }: SearchShopsProps) {
  const { data: shops = [], isLoading } = useQuery<Shop[]>({
    queryKey: ['shop-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const response = await apiRequest('GET', `/api/shops/search?query=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: searchQuery.length >= 2
  });

  if (searchQuery.length < 2 || (!isLoading && shops.length === 0)) {
    return null;
  }

  return (
    <div className="mb-6 max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg border-2 border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2">
            <Store className="w-4 h-4" />
            Shops
          </h3>
        </div>
        
        {isLoading ? (
          <div className="p-4 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="divide-y max-h-60 overflow-y-auto">
            {shops.map((shop) => (
              <Link key={shop.id} href={`/shop/${shop.shopSlug || shop.id}`}>
                <div className="p-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between group transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center overflow-hidden">
                      {shop.shopLogoUrl ? (
                        <img src={shop.shopLogoUrl} alt={shop.companyName} className="w-full h-full object-cover" />
                      ) : (
                        <Store className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{shop.companyName}</p>
                      <p className="text-sm text-gray-500 line-clamp-1">
                        {shop.shopDescription || shop.email}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-red-600 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
