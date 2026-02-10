// // This file contains the fixed pagination components to replace in inventory-dashboard.tsx

// // For the "Try Again" button:
// <Button onClick={() => fetchInventoryItems(1)}>Try Again</Button>

// // For the PaginationPrevious component:
// <PaginationPrevious 
//   onClick={(e) => {
//     e.preventDefault();
//     if (currentPage > 1) {
//       setCurrentPage(currentPage - 1);
//       fetchInventoryItems(currentPage - 1);
//     }
//   }}
//   className={currentPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
// />

// // For the PaginationLink components:
// <PaginationLink 
//   onClick={(e) => {
//     e.preventDefault();
//     setCurrentPage(1);
//     fetchInventoryItems(1);
//   }}
// >
//   1
// </PaginationLink>

// <PaginationLink 
//   onClick={(e) => {
//     e.preventDefault();
//     setCurrentPage(currentPage - 1);
//     fetchInventoryItems(currentPage - 1);
//   }}
// >
//   {currentPage - 1}
// </PaginationLink>

// <PaginationLink 
//   onClick={(e) => {
//     e.preventDefault();
//     setCurrentPage(currentPage + 1);
//     fetchInventoryItems(currentPage + 1);
//   }}
// >
//   {currentPage + 1}
// </PaginationLink>

// <PaginationLink 
//   onClick={(e) => {
//     e.preventDefault();
//     setCurrentPage(totalPages);
//     fetchInventoryItems(totalPages);
//   }}
// >
//   {totalPages}
// </PaginationLink>

// // For the PaginationNext component:
// <PaginationNext 
//   onClick={(e) => {
//     e.preventDefault();
//     if (currentPage < totalPages) {
//       setCurrentPage(currentPage + 1);
//       fetchInventoryItems(currentPage + 1);
//     }
//   }}
//   className={currentPage >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
// />

// // Import statement at the top of the file:
// import { useState, useEffect, useRef } from "react";
