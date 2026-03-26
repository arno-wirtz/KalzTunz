#!/usr/bin/env python3
"""
Enhanced Email System for KalzTunz
Handles user notifications, social interactions, and account emails
"""

import os
import logging
import smtplib
from datetime import datetime
from typing import List, Dict, Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from jinja2 import Template

logger = logging.getLogger(__name__)

# ==================== CONFIGURATION ====================

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "noreply@kalztunz.com")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD", "")
SENDER_NAME = "KalzTunz"

class EmailTemplates:
    """Email HTML templates"""

    WELCOME_EMAIL = """
    <html>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
                    <h1 style="margin: 0; font-size: 28px;">🎵 Welcome to KalzTunz</h1>
                </div>

                <!-- Content -->
                <div style="padding: 30px;">
                    <p style="font-size: 16px; color: #333;">
                        Hi <strong>{{ username }}</strong>,
                    </p>

                    <p style="font-size: 14px; color: #666; line-height: 1.6;">
                        Welcome to KalzTunz! We're excited to have you join our music creation community.
                    </p>

                    <p style="font-size: 14px; color: #666; line-height: 1.6;">
                        Get started by:
                    </p>

                    <ul style="font-size: 14px; color: #666;">
                        <li>Creating your first song with our AI tools</li>
                        <li>Discovering music from other artists</li>
                        <li>Building your music library</li>
                        <li>Connecting with other musicians</li>
                    </ul>

                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{ login_url }}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 40px; border-radius: 25px; text-decoration: none; font-weight: bold;">
                            Get Started Now
                        </a>
                    </div>

                    <p style="font-size: 12px; color: #999;">
                        If you didn't sign up for KalzTunz, please ignore this email.
                    </p>
                </div>

                <!-- Footer -->
                <div style="background-color: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eee;">
                    <p style="font-size: 11px; color: #999; margin: 0;">
                        © 2025 KalzTunz. All rights reserved.
                    </p>
                </div>
            </div>
        </body>
    </html>
    """

    FOLLOW_NOTIFICATION = """
    <html>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; color: white;">
                    <h2 style="margin: 0;">👥 New Follower</h2>
                </div>

                <div style="padding: 30px;">
                    <p style="font-size: 16px; color: #333;">
                        Hi {{ followed_username }},
                    </p>

                    <p style="font-size: 14px; color: #666; line-height: 1.6;">
                        <strong>{{ follower_name }}</strong> is now following you! 🎉
                    </p>

                    <div style="text-align: center; margin: 20px 0;">
                        <a href="{{ profile_url }}" style="display: inline-block; background: #667eea; color: white; padding: 10px 30px; border-radius: 20px; text-decoration: none; font-weight: bold;">
                            View Profile
                        </a>
                    </div>
                </div>
            </div>
        </body>
    </html>
    """

    TRACK_SHARED = """
    <html>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; color: white;">
                    <h2 style="margin: 0;">🎵 New Track Shared</h2>
                </div>

                <div style="padding: 30px;">
                    <p style="font-size: 16px; color: #333;">
                        Hi {{ recipient_name }},
                    </p>

                    <p style="font-size: 14px; color: #666; line-height: 1.6;">
                        <strong>{{ sender_name }}</strong> shared a track with you: <strong>{{ track_title }}</strong>
                    </p>

                    <div style="background-color: #f0f0f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0; font-size: 12px; color: #666;">
                            {{ track_description }}
                        </p>
                    </div>

                    <div style="text-align: center;">
                        <a href="{{ track_url }}" style="display: inline-block; background: #667eea; color: white; padding: 10px 30px; border-radius: 20px; text-decoration: none; font-weight: bold;">
                            Listen Now
                        </a>
                    </div>
                </div>
            </div>
        </body>
    </html>
    """

class EmailService:
    """Handle all email communications"""

    def __init__(self):
        self.enabled = bool(SENDER_PASSWORD)

    def send_email(self, to_email: str, subject: str, html_content: str, plain_text: Optional[str] = None) -> bool:
        """Send email with error handling"""
        if not self.enabled:
            logger.warning(f"Email disabled - would send to {to_email}: {subject}")
            return False

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{SENDER_NAME} <{SENDER_EMAIL}>"
            msg["To"] = to_email

            if plain_text:
                part1 = MIMEText(plain_text, "plain")
                msg.attach(part1)

            part2 = MIMEText(html_content, "html")
            msg.attach(part2)

            with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
                server.starttls()
                server.login(SENDER_EMAIL, SENDER_PASSWORD)
                server.sendmail(SENDER_EMAIL, to_email, msg.as_string())

            logger.info(f"✓ Email sent to {to_email}: {subject}")
            return True

        except Exception as e:
            logger.error(f"✗ Email send error to {to_email}: {e}")
            return False

    def send_welcome_email(self, email: str, username: str, login_url: str) -> bool:
        """Send welcome email to new user"""
        template = Template(EmailTemplates.WELCOME_EMAIL)
        html = template.render(username=username, login_url=login_url)
        
        return self.send_email(
            to_email=email,
            subject="Welcome to KalzTunz! 🎵",
            html_content=html,
        )

    def send_follow_notification(self, email: str, followed_username: str, follower_name: str, profile_url: str) -> bool:
        """Notify user of new follower"""
        template = Template(EmailTemplates.FOLLOW_NOTIFICATION)
        html = template.render(
            followed_username=followed_username,
            follower_name=follower_name,
            profile_url=profile_url,
        )
        
        return self.send_email(
            to_email=email,
            subject=f"{follower_name} is now following you! 👥",
            html_content=html,
        )

    def send_track_shared_notification(self, email: str, recipient_name: str, sender_name: str, track_title: str, track_description: str, track_url: str) -> bool:
        """Notify user of shared track"""
        template = Template(EmailTemplates.TRACK_SHARED)
        html = template.render(
            recipient_name=recipient_name,
            sender_name=sender_name,
            track_title=track_title,
            track_description=track_description,
            track_url=track_url,
        )
        
        return self.send_email(
            to_email=email,
            subject=f"🎵 {sender_name} shared a track with you!",
            html_content=html,
        )

# Global instance
email_service = EmailService()