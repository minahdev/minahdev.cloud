from shared.a2a_schemas import A2AMessage, A2ATaskRequest, A2ATaskResult


def test_message_text_helper_roundtrips() -> None:
    msg = A2AMessage.text("user", "hello world")
    assert msg.content == "hello world"
    assert A2AMessage.model_validate(msg.model_dump()) == msg


def test_task_request_has_generated_ids() -> None:
    req = A2ATaskRequest(message=A2AMessage.text("user", "q"))
    assert req.task_id
    assert req.message.message_id


def test_task_result_serialization_roundtrips() -> None:
    result = A2ATaskResult(
        task_id="t1",
        status="completed",
        message=A2AMessage.text("agent", "done"),
    )
    restored = A2ATaskResult.model_validate(result.model_dump())
    assert restored.status == "completed"
    assert restored.message.content == "done"
