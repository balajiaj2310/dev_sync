import json

from channels.generic.websocket import AsyncWebsocketConsumer


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.conv_id = self.scope["url_route"]["kwargs"].get(
            "conversation_id", "general"
        )
        self.room_group_name = f"chat_{self.conv_id}"

        # Join room group
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            action = data.get("action", "message")

            if action == "message":
                # Broadcast message to room group
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "chat_message",
                        "message": data.get("text", ""),
                        "sender": data.get("sender", "Anonymous"),
                    },
                )
            elif action == "typing":
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "typing_indicator",
                        "sender": data.get("sender", "Anonymous"),
                    },
                )
        except Exception:
            pass

    async def chat_message(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "message",
                    "message": event["message"],
                    "sender": event["sender"],
                }
            )
        )

    async def typing_indicator(self, event):
        await self.send(
            text_data=json.dumps({"type": "typing", "sender": event["sender"]})
        )
