"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Plus, Edit, Trash2, Search, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getFAQs, createFAQ, updateFAQ, deleteFAQ, queryFAQs } from "@/lib/ai";

interface FAQ {
  id: number;
  question: string;
  sql: string;
  category: string;
  created_at: string;
}

interface FAQFormData {
  question: string;
  sql: string;
  category: string;
}

export function FAQManager() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [currentFAQ, setCurrentFAQ] = useState<FAQ | null>(null);
  const [formData, setFormData] = useState<FAQFormData>({
    question: "",
    sql: "",
    category: "",
  });
  
  const { toast } = useToast();
  
  const categories = ["all", ...Array.from(new Set(faqs.map(faq => faq.category)))];
  
  // Load FAQs on component mount
  useEffect(() => {
    loadFAQs();
  }, []);
  
  const loadFAQs = async () => {
    setIsLoading(true);
    try {
      const data = await getFAQs();
      setFaqs(data);
    } catch (error) {
      toast({
        title: "Error loading FAQs",
        description: "Could not load FAQs. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadFAQs();
      return;
    }
    
    setIsLoading(true);
    try {
      const data = await queryFAQs(searchQuery, selectedCategory !== "all" ? selectedCategory : "");
      setFaqs(data);
    } catch (error) {
      toast({
        title: "Error searching FAQs",
        description: "Could not search FAQs. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAddFAQ = async () => {
    setIsLoading(true);
    try {
      await createFAQ(formData);
      setShowAddDialog(false);
      setFormData({ question: "", sql: "", category: "" });
      toast({
        title: "FAQ Added",
        description: "The FAQ has been added successfully.",
      });
      loadFAQs();
    } catch (error) {
      toast({
        title: "Error adding FAQ",
        description: "Could not add FAQ. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleEditFAQ = async () => {
    if (!currentFAQ) return;
    
    setIsLoading(true);
    try {
      await updateFAQ(currentFAQ.id, formData);
      setShowEditDialog(false);
      setCurrentFAQ(null);
      toast({
        title: "FAQ Updated",
        description: "The FAQ has been updated successfully.",
      });
      loadFAQs();
    } catch (error) {
      toast({
        title: "Error updating FAQ",
        description: "Could not update FAQ. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteFAQ = async (id: number) => {
    if (!confirm("Are you sure you want to delete this FAQ?")) return;
    
    setIsLoading(true);
    try {
      await deleteFAQ(id);
      toast({
        title: "FAQ Deleted",
        description: "The FAQ has been deleted successfully.",
      });
      loadFAQs();
    } catch (error) {
      toast({
        title: "Error deleting FAQ",
        description: "Could not delete FAQ. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const openEditDialog = (faq: FAQ) => {
    setCurrentFAQ(faq);
    setFormData({
      question: faq.question,
      sql: faq.sql,
      category: faq.category,
    });
    setShowEditDialog(true);
  };
  
  return (
    <Card className="w-full border-0 shadow-none bg-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-ink font-urbanist">
            <span className="text-2xl">📚</span>
            FAQ Management
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button variant="default" size="sm">
                <Plus className="w-4 h-4 mr-1" /> Add FAQ
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New FAQ</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label htmlFor="question" className="text-sm font-medium">Question</label>
                  <Input 
                    id="question" 
                    value={formData.question}
                    onChange={(e) => setFormData({...formData, question: e.target.value})}
                    placeholder="E.g., What's my total inventory value?"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="sql" className="text-sm font-medium">SQL Query</label>
                  <Textarea 
                    id="sql" 
                    value={formData.sql}
                    onChange={(e) => setFormData({...formData, sql: e.target.value})}
                    placeholder="SELECT SUM(price) AS total_value FROM inventory_inventoryitem"
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="category" className="text-sm font-medium">Category</label>
                  <Input 
                    id="category" 
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    placeholder="E.g., inventory, pricing, location"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                <Button onClick={handleAddFAQ} disabled={isLoading}>
                  {isLoading ? "Adding..." : "Add FAQ"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardTitle>
        <p className="text-sm text-ink/70 font-urbanist">
          Manage frequently asked questions and their SQL queries for the AI assistant
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-4">
          {/* Search and Filter */}
          <div className="flex flex-col md:flex-row gap-2">
            <div className="flex-1 relative">
              <Input
                placeholder="Search FAQs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              <Search className="w-4 h-4 absolute left-3 top-3 text-ink/50" />
            </div>
            <div className="flex gap-2">
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
              <Button onClick={handleSearch} disabled={isLoading}>
                {isLoading ? "Searching..." : "Search"}
              </Button>
            </div>
          </div>
          
          {/* FAQ Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Question</TableHead>
                  <TableHead className="w-[40%]">SQL</TableHead>
                  <TableHead className="w-[10%]">Category</TableHead>
                  <TableHead className="w-[10%]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faqs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      {isLoading ? "Loading FAQs..." : "No FAQs found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  faqs.map((faq) => (
                    <TableRow key={faq.id}>
                      <TableCell className="font-medium">{faq.question}</TableCell>
                      <TableCell className="font-mono text-xs whitespace-pre-wrap">
                        {faq.sql.length > 100 ? `${faq.sql.substring(0, 100)}...` : faq.sql}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{faq.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(faq)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteFAQ(faq.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        
        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit FAQ</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="edit-question" className="text-sm font-medium">Question</label>
                <Input 
                  id="edit-question" 
                  value={formData.question}
                  onChange={(e) => setFormData({...formData, question: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="edit-sql" className="text-sm font-medium">SQL Query</label>
                <Textarea 
                  id="edit-sql" 
                  value={formData.sql}
                  onChange={(e) => setFormData({...formData, sql: e.target.value})}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="edit-category" className="text-sm font-medium">Category</label>
                <Input 
                  id="edit-category" 
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
              <Button onClick={handleEditFAQ} disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
