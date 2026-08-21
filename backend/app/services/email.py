"""Email delivery boundary. OTPs are never logged; tests may inspect the in-memory sink only."""
from dataclasses import dataclass
from email.message import EmailMessage
import smtplib
from app.core.config import get_settings


@dataclass
class SentEmail:
    recipient: str
    purpose: str
    otp: str


class EmailService:
    def __init__(self): self.outbox: list[SentEmail] = []
    def send_otp(self, recipient: str, purpose: str, otp: str) -> None:
        settings = get_settings()
        if settings.email_backend == "test":
            self.outbox.append(SentEmail(recipient, purpose, otp))
            return
        if settings.email_backend == "smtp":
            message = EmailMessage()
            message["From"], message["To"], message["Subject"] = settings.email_from, recipient, "AI Memory Hub verification code"
            message.set_content(f"Your {purpose.replace('_', ' ')} code is: {otp}")
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
                smtp.starttls(); smtp.login(settings.smtp_username, settings.smtp_password); smtp.send_message(message)
        # Console mode intentionally does not print the OTP.


email_service = EmailService()

