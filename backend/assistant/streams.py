import os, json
from django.http import StreamingHttpResponse, HttpResponseNotAllowed
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def sse_chat_stream(request):
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    try:
        body = json.loads(request.body.decode("utf-8"))
    except Exception:
        body = {}

    query = body.get("query", "")
    history = body.get("history", [])
    messages = [{"role":"system","content":"You are a helpful inventory assistant."}, *history, {"role":"user","content":query}]

    def gen():
        try:
            stream = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.2,
                stream=True,
            )
            # send tokens as they arrive
            for chunk in stream:
                delta = (chunk.choices[0].delta.content or "")
                if delta:
                    yield f"event: token\ndata: {json.dumps(delta)}\n\n"
            yield "event: done\ndata: {}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps(str(e))}\n\n"

    resp = StreamingHttpResponse(gen(), content_type="text/event-stream")
    resp["Cache-Control"] = "no-cache"
    resp["X-Accel-Buffering"] = "no"  # for nginx
    return resp
