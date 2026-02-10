// "use client"

// import { useState, useEffect } from "react"
// import { X, Check } from "lucide-react"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Textarea } from "@/components/ui/textarea"
// import { Label } from "@/components/ui/label"
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// import { Card, CardContent } from "@/components/ui/card"
// import type { LocationNode } from "../types/location"

// interface AddLocationModalProps {
//   isOpen: boolean
//   onClose: () => void
//   onSave: (locationData: Partial<LocationNode>) => void
//   locations: LocationNode
//   selectedLocationId?: string | null
// }

// const locationTypes = [
//   { id: "building", name: "Building", icon: "🏢", description: "Primary container for all locations" },
//   { id: "room", name: "Room", icon: "🚪", description: "Space within a building" },
//   { id: "shelf", name: "Shelf", icon: "📚", description: "Storage unit within a room" },
//   { id: "box", name: "Box", icon: "📦", description: "Container within a shelf" },
//   { id: "row", name: "Row", icon: "📄", description: "Section within a box" },
// ]

// const typeHierarchy = {
//   building: [],
//   room: ["building"],
//   shelf: ["room"],
//   box: ["shelf"],
//   row: ["box"],
// }

// export function AddLocationModal({ isOpen, onClose, onSave, locations, selectedLocationId }: AddLocationModalProps) {
//   const [formData, setFormData] = useState({
//     type: "",
//     parentId: selectedLocationId || "",
//     name: "",
//     description: "",
//     capacity: "",
//   })
//   const [errors, setErrors] = useState<Record<string, string>>({})
//   const [preview, setPreview] = useState<string>("")

//   useEffect(() => {
//     if (selectedLocationId) {
//       setFormData((prev) => ({ ...prev, parentId: selectedLocationId }))
//     }
//   }, [selectedLocationId])

//   useEffect(() => {
//     updatePreview()
//   }, [formData])

//   const flattenLocations = (
//     node: LocationNode,
//     path = "",
//   ): Array<{ id: string; name: string; type: string; path: string }> => {
//     const currentPath = path ? `${path} > ${node.name}` : node.name
//     const result = [{ id: node.id, name: node.name, type: node.type, path: currentPath }]

//     if (node.children) {
//       node.children.forEach((child) => {
//         result.push(...flattenLocations(child, currentPath))
//       })
//     }

//     return result
//   }

//   const allLocations = flattenLocations(locations)

//   const getValidParents = (selectedType: string) => {
//     const validParentTypes = typeHierarchy[selectedType as keyof typeof typeHierarchy] || []
//     return allLocations.filter((loc) => validParentTypes.includes(loc.type))
//   }

//   const updatePreview = () => {
//     if (formData.type && formData.name) {
//       if (formData.parentId) {
//         const parent = allLocations.find((loc) => loc.id === formData.parentId)
//         if (parent) {
//           setPreview(`${parent.path} > [NEW] ${formData.name}`)
//         }
//       } else {
//         setPreview(`[NEW] ${formData.name}`)
//       }
//     } else {
//       setPreview("")
//     }
//   }

//   const validateForm = () => {
//     const newErrors: Record<string, string> = {}

//     if (!formData.type) {
//       newErrors.type = "Location type is required"
//     }

//     if (!formData.name.trim()) {
//       newErrors.name = "Name is required"
//     }

//     if (formData.type !== "building" && !formData.parentId) {
//       newErrors.parentId = "Parent location is required"
//     }

//     if (formData.capacity && (isNaN(Number(formData.capacity)) || Number(formData.capacity) <= 0)) {
//       newErrors.capacity = "Capacity must be a positive number"
//     }

//     setErrors(newErrors)
//     return Object.keys(newErrors).length === 0
//   }

//   const handleSave = () => {
//     if (validateForm()) {
//       const locationData: Partial<LocationNode> = {
//         name: formData.name,
//         type: formData.type as LocationNode["type"],
//         description: formData.description || undefined,
//         capacity: formData.capacity ? Number(formData.capacity) : undefined,
//         children: [],
//       }

//       onSave(locationData)
//       handleClose()
//     }
//   }

//   const handleClose = () => {
//     setFormData({
//       type: "",
//       parentId: selectedLocationId || "",
//       name: "",
//       description: "",
//       capacity: "",
//     })
//     setErrors({})
//     setPreview("")
//     onClose()
//   }

//   return (
//     <Dialog open={isOpen} onOpenChange={handleClose}>
//       <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
//         <DialogHeader>
//           <DialogTitle className="flex items-center justify-between">
//             <span>Add New Location</span>
//             <Button variant="ghost" size="sm" onClick={handleClose}>
//               <X className="h-4 w-4" />
//             </Button>
//           </DialogTitle>
//         </DialogHeader>

//         <div className="space-y-6">
//           {/* Section 1 - Location Type */}
//           <div>
//             <Label className="text-base font-semibold">Location Type</Label>
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
//               {locationTypes.map((type) => (
//                 <Card
//                   key={type.id}
//                   className={`cursor-pointer transition-all hover:shadow-md ${
//                     formData.type === type.id ? "ring-2 ring-blue-500 bg-blue-50" : "hover:bg-gray-50"
//                   }`}
//                   onClick={() => setFormData({ ...formData, type: type.id, parentId: "" })}
//                 >
//                   <CardContent className="p-4">
//                     <div className="flex items-center gap-3">
//                       <span className="text-2xl">{type.icon}</span>
//                       <div>
//                         <div className="font-medium">{type.name}</div>
//                         <div className="text-sm text-gray-600">{type.description}</div>
//                       </div>
//                     </div>
//                   </CardContent>
//                 </Card>
//               ))}
//             </div>
//             {errors.type && <p className="text-red-500 text-sm mt-2">{errors.type}</p>}
//           </div>

//           {/* Section 2 - Parent Location */}
//           {formData.type && formData.type !== "building" && (
//             <div>
//               <Label htmlFor="parentId" className="text-base font-semibold">
//                 Parent Location
//               </Label>
//               <Select
//                 value={formData.parentId}
//                 onValueChange={(value) => setFormData({ ...formData, parentId: value })}
//               >
//                 <SelectTrigger className="mt-2">
//                   <SelectValue placeholder="Select parent location" />
//                 </SelectTrigger>
//                 <SelectContent>
//                   {getValidParents(formData.type).map((location) => (
//                     <SelectItem key={location.id} value={location.id}>
//                       {location.path}
//                     </SelectItem>
//                   ))}
//                 </SelectContent>
//               </Select>
//               {errors.parentId && <p className="text-red-500 text-sm mt-1">{errors.parentId}</p>}
//             </div>
//           )}

//           {/* Section 3 - Location Details */}
//           <div className="space-y-4">
//             <Label className="text-base font-semibold">Location Details</Label>

//             <div>
//               <Label htmlFor="name">Name *</Label>
//               <Input
//                 id="name"
//                 value={formData.name}
//                 onChange={(e) => setFormData({ ...formData, name: e.target.value })}
//                 placeholder="Enter location name"
//                 className="mt-1"
//               />
//               {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
//             </div>

//             <div>
//               <Label htmlFor="description">Description</Label>
//               <Textarea
//                 id="description"
//                 value={formData.description}
//                 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
//                 placeholder="Optional description"
//                 rows={3}
//                 className="mt-1"
//               />
//             </div>

//             <div>
//               <Label htmlFor="capacity">Capacity (number of items)</Label>
//               <Input
//                 id="capacity"
//                 type="number"
//                 value={formData.capacity}
//                 onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
//                 placeholder="Optional capacity limit"
//                 className="mt-1"
//               />
//               {errors.capacity && <p className="text-red-500 text-sm mt-1">{errors.capacity}</p>}
//             </div>
//           </div>

//           {/* Section 4 - Visual Preview */}
//           {preview && (
//             <div>
//               <Label className="text-base font-semibold">Preview</Label>
//               <div className="mt-2 p-4 bg-green-50 border border-green-200 rounded-lg">
//                 <div className="flex items-center gap-2 mb-2">
//                   <Check className="h-5 w-5 text-green-600" />
//                   <span className="font-medium text-green-800">Location Preview</span>
//                 </div>
//                 <p className="text-green-700 font-mono text-sm">{preview}</p>
//                 <p className="text-green-600 text-sm mt-1">
//                   This {formData.type} will be created{" "}
//                   {formData.parentId ? "inside the selected parent location" : "as a top-level building"}
//                 </p>
//               </div>
//             </div>
//           )}
//         </div>

//         {/* Footer */}
//         <div className="flex justify-end gap-3 pt-6 border-t">
//           <Button variant="outline" onClick={handleClose}>
//             Cancel
//           </Button>
//           <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
//             Create Location
//           </Button>
//         </div>
//       </DialogContent>
//     </Dialog>
//   )
// }
