from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db import models
from django.core.paginator import Paginator, EmptyPage
import logging
from .models import Client
from .serializers import ClientSerializer

logger = logging.getLogger(__name__)

class ClientListView(APIView):
    """
    GET /api/v1/clients/ - List all clients with pagination and search
    POST /api/v1/clients/ - Create a new client
    """
    
    def get(self, request):
        logger.info("[inventory_client] Client list request received")

        try:
            # Get query parameters
            search_query = request.GET.get('q', '').strip()
            page = int(request.GET.get('page', 1))
            page_size = min(int(request.GET.get('page_size', 25)), 100)

            # Base queryset
            clients = Client.objects.all().order_by('-created_at')

            # Apply search filter if provided
            if search_query:
                clients = clients.filter(
                    models.Q(name__icontains=search_query) |
                    models.Q(contact_email__icontains=search_query)
                )

            # Pagination
            paginator = Paginator(clients, page_size)
            
            try:
                page_obj = paginator.page(page)
            except EmptyPage:
                page_obj = paginator.page(paginator.num_pages)

            # Serialize data
            serializer = ClientSerializer(page_obj, many=True)
            
            response_data = {
                "success": True,
                "clients": serializer.data,
                "count": paginator.count,
                "total_pages": paginator.num_pages,
                "current_page": page,
                "page_size": page_size
            }

            logger.info(f"[inventory_client] Retrieved {len(serializer.data)} clients")
            return Response(response_data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.exception(f"[inventory_client] Error fetching clients: {str(e)}")
            return Response(
                {"success": False, "error": "Internal server error"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def post(self, request):
        logger.info("[inventory_client] Client creation request received")

        try:
            serializer = ClientSerializer(data=request.data)
            if serializer.is_valid():
                client = serializer.save()
                
                logger.info(f"[inventory_client] Client created successfully: {client.name} (ID: {client.id})")
                
                response_data = {
                    "success": True,
                    "client": ClientSerializer(client).data,
                    "message": "Client created successfully"
                }
                return Response(response_data, status=status.HTTP_201_CREATED)
            else:
                logger.warning(f"[inventory_client] Client creation validation failed: {serializer.errors}")
                return Response(
                    {"success": False, "errors": serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except Exception as e:
            logger.exception(f"[inventory_client] Error creating client: {str(e)}")
            return Response(
                {"success": False, "error": "Internal server error"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ClientDetailView(APIView):
    """
    GET /api/v1/clients/{id}/ - Get client details
    PUT /api/v1/clients/{id}/ - Update client
    DELETE /api/v1/clients/{id}/ - Delete client
    """

    def get_object(self, client_id):
        try:
            return Client.objects.get(id=client_id)
        except Client.DoesNotExist:
            return None

    def get(self, request, client_id):
        logger.info(f"[inventory_client] Client details request for ID: {client_id}")

        try:
            client = self.get_object(client_id)
            if not client:
                return Response(
                    {"success": False, "error": "Client not found"},
                    status=status.HTTP_404_NOT_FOUND
                )

            serializer = ClientSerializer(client)
            return Response({"success": True, "client": serializer.data}, status=status.HTTP_200_OK)

        except Exception as e:
            logger.exception(f"[inventory_client] Error fetching client details: {str(e)}")
            return Response(
                {"success": False, "error": "Internal server error"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def put(self, request, client_id):
        logger.info(f"[inventory_client] Client update request for ID: {client_id}")

        try:
            client = self.get_object(client_id)
            if not client:
                return Response(
                    {"success": False, "error": "Client not found"},
                    status=status.HTTP_404_NOT_FOUND
                )

            serializer = ClientSerializer(client, data=request.data, partial=False)
            if serializer.is_valid():
                updated_client = serializer.save()
                
                logger.info(f"[inventory_client] Client updated successfully: {updated_client.name} (ID: {updated_client.id})")
                
                response_data = {
                    "success": True,
                    "client": ClientSerializer(updated_client).data,
                    "message": "Client updated successfully"
                }
                return Response(response_data, status=status.HTTP_200_OK)
            else:
                logger.warning(f"[inventory_client] Client update validation failed: {serializer.errors}")
                return Response(
                    {"success": False, "errors": serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except Exception as e:
            logger.exception(f"[inventory_client] Error updating client: {str(e)}")
            return Response(
                {"success": False, "error": "Internal server error"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def delete(self, request, client_id):
        logger.info(f"[inventory_client] Client deletion request for ID: {client_id}")

        try:
            client = self.get_object(client_id)
            if not client:
                return Response(
                    {"success": False, "error": "Client not found"},
                    status=status.HTTP_404_NOT_FOUND
                )

            client_name = client.name
            client.delete()
            
            logger.info(f"[inventory_client] Client deleted successfully: {client_name} (ID: {client_id})")
            
            return Response(
                {"success": True, "message": "Client deleted successfully"},
                status=status.HTTP_200_OK
            )

        except Exception as e:
            logger.exception(f"[inventory_client] Error deleting client: {str(e)}")
            return Response(
                {"success": False, "error": "Internal server error"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ClientBulkDeleteView(APIView):
    """
    POST /api/v1/clients/bulk-delete/ - Bulk delete clients
    """

    def post(self, request):
        logger.info("[inventory_client] Bulk delete request received")

        try:
            client_ids = request.data.get('client_ids', [])
            if not client_ids:
                return Response(
                    {"success": False, "error": "No client IDs provided"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validate that all IDs are valid UUIDs and exist
            clients = Client.objects.filter(id__in=client_ids)
            found_ids = set(str(client.id) for client in clients)
            missing_ids = set(str(client_id) for client_id in client_ids) - found_ids

            if missing_ids:
                return Response(
                    {
                        "success": False, 
                        "error": f"Some clients not found: {', '.join(missing_ids)}"
                    },
                    status=status.HTTP_404_NOT_FOUND
                )

            # Delete clients
            delete_count = clients.count()
            clients.delete()

            logger.info(f"[inventory_client] Bulk delete completed: {delete_count} clients deleted")
            
            return Response(
                {
                    "success": True, 
                    "message": f"Successfully deleted {delete_count} client(s)",
                    "deleted_count": delete_count
                },
                status=status.HTTP_200_OK
            )

        except Exception as e:
            logger.exception(f"[inventory_client] Error in bulk delete: {str(e)}")
            return Response(
                {"success": False, "error": "Internal server error"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )