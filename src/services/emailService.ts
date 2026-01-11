import nodemailer from "nodemailer";
import { logService } from "./logService";
import { FileService } from "./fileService";
import { d1Service } from "./d1Service";
import type { EmailConfig, Contact, EmailJob } from "../types";

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  createTransport(config: EmailConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });
  }

  // ADD THIS NEW METHOD
  async sendSingleEmail(mailOptions: any): Promise<any> {
    if (!this.transporter) {
      throw new Error("Email transporter not configured");
    }
    return await this.transporter.sendMail(mailOptions);
  }

  // async sendBulkEmails(job: EmailJob): Promise<void> {
  //   if (!this.transporter) {
  //     throw new Error("Email transporter not configured");
  //   }

  //   console.log(`Starting bulk email send for ${job.contacts.length} contacts`);

  //   for (let i = 0; i < job.contacts.length; i++) {
  //     const contact = job.contacts[i];

  //     try {
  //       // Replace placeholders in HTML content
  //       const personalizedContent = FileService.replacePlaceholders(
  //         job.htmlContent,
  //         contact
  //       );
  //       const personalizedSubject = FileService.replacePlaceholders(
  //         job.subject,
  //         contact
  //       );

  //       const mailOptions = {
  //         from: `${job.fromName} <${job.fromEmail}>`,
  //         to: contact.Email,
  //         subject: personalizedSubject,
  //         html: personalizedContent,
  //       };

  //       const info = await this.transporter.sendMail(mailOptions);

  //       logService.addLog({
  //         id: `email_${Date.now()}_${i}`,
  //         email: contact.Email,
  //         status: "Sent",
  //         timestamp: new Date().toISOString(),
  //         messageId: info.messageId,
  //         firstName: contact.FirstName,
  //         company: contact.Company,
  //         subject: personalizedSubject,
  //       });

  //       console.log(`Email sent to ${contact.Email}: ${info.messageId}`);
  //     } catch (error) {
  //       const errorMessage =
  //         error instanceof Error ? error.message : "Unknown error";

  //       logService.addLog({
  //         id: `email_${Date.now()}_${i}`,
  //         email: contact.Email,
  //         status: "Failed",
  //         message: errorMessage,
  //         timestamp: new Date().toISOString(),
  //         firstName: contact.FirstName,
  //         company: contact.Company,
  //         subject: job.subject,
  //       });

  //       console.error(
  //         `Failed to send email to ${contact.Email}:`,
  //         errorMessage
  //       );
  //     }

  //     // Add delay between emails (15-30 seconds)
  //     if (i < job.contacts.length - 1) {
  //       const delay = job.delay * 1000; // Convert to milliseconds
  //       console.log(`Waiting ${delay / 1000} seconds before next email...`);
  //       await new Promise((resolve) => setTimeout(resolve, delay));
  //     }
  //   }

  //   console.log("Bulk email send completed");
  // }

  async sendBulkEmails(
    job: EmailJob,
    notificationSettings?: {
      email?: string;
      userId?: string;
      configName?: string;
    },
    trackingOptions?: {
      userId: string;
      campaignId?: string;
      sendType?: 'direct' | 'batch' | 'scheduled';
      providerType?: 'smtp' | 'google' | 'microsoft';
      configName?: string;
    }
  ): Promise<void> {
    if (!this.transporter) {
      throw new Error("Email transporter not configured");
    }

    console.log(`Starting bulk email send for ${job.contacts.length} contacts`);
    const startTime = new Date().toISOString();

    let sentCount = 0;
    let failedCount = 0;

    // Generate campaign ID for tracking
    const campaignId = trackingOptions?.campaignId || d1Service.generateCampaignId();

    for (let i = 0; i < job.contacts.length; i++) {
      const contact = job.contacts[i];

      try {
        // Replace placeholders in HTML content
        let personalizedContent = FileService.replacePlaceholders(
          job.htmlContent,
          contact
        );
        const personalizedSubject = FileService.replacePlaceholders(
          job.subject,
          contact
        );

        // Register with tracking service and inject tracking pixel/links
        if (d1Service.isConfigured() && trackingOptions?.userId) {
          const trackingResult = await d1Service.registerEmail({
            userId: trackingOptions.userId,
            campaignId,
            campaignName: `Campaign ${new Date().toLocaleDateString()}`,
            subject: personalizedSubject,
            fromEmail: job.fromEmail,
            fromName: job.fromName,
            recipientEmail: contact.Email,
            recipientName: (contact.FirstName || String(contact['Name'] || '')),
            sendType: trackingOptions.sendType || 'direct',
            providerType: trackingOptions.providerType || 'smtp',
            configName: trackingOptions.configName || ''
          });

          if (trackingResult) {
            personalizedContent = d1Service.injectTracking(personalizedContent, trackingResult.trackingId);
          }
        }

        const mailOptions = {
          from: `${job.fromName} <${job.fromEmail}>`,
          to: contact.Email,
          subject: personalizedSubject,
          html: personalizedContent,
        };

        const info = await this.transporter.sendMail(mailOptions);

        logService.addLog({
          id: `email_${Date.now()}_${i}`,
          email: contact.Email,
          status: "Sent",
          timestamp: new Date().toISOString(),
          messageId: info.messageId,
          firstName: contact.FirstName,
          company: contact.Company,
          subject: personalizedSubject,
        });

        console.log(`Email sent to ${contact.Email}: ${info.messageId}`);
        sentCount++;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        logService.addLog({
          id: `email_${Date.now()}_${i}`,
          email: contact.Email,
          status: "Failed",
          message: errorMessage,
          timestamp: new Date().toISOString(),
          firstName: contact.FirstName,
          company: contact.Company,
          subject: job.subject,
        });

        console.error(
          `Failed to send email to ${contact.Email}:`,
          errorMessage
        );
        failedCount++;
      }

      // Add delay between emails (15-30 seconds)
      if (i < job.contacts.length - 1) {
        const delay = job.delay * 1000; // Convert to milliseconds
        console.log(`Waiting ${delay / 1000} seconds before next email...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    console.log("Bulk email send completed");
    // NEW: Send completion notification if requested
    if (notificationSettings?.email && notificationSettings?.userId) {
      await this.sendBulkCompletionNotification(
        job,
        {
          email: notificationSettings.email,
          userId: notificationSettings.userId,
          configName: notificationSettings.configName
        },
        startTime,
        sentCount,
        failedCount
      );
    }
  }

  private async sendBulkCompletionNotification(
    job: EmailJob,
    notificationSettings: {
      email: string;
      userId: string;
      configName?: string;
    },
    startTime: string,
    sentCount: number,
    failedCount: number
  ): Promise<void> {
    try {
      const { notificationService } = await import("./notificationService");

      const jobStats = {
        sent: sentCount,
        failed: failedCount,
        total: job.contacts.length,
        errors: 0,
      };

      const jobDetails = {
        id: `bulk_${Date.now()}`,
        subject: job.subject,
        startTime,
        endTime: new Date().toISOString(),
        configUsed:
          notificationSettings.configName || "Bulk Email Configuration",
        batchMode: false,
      };

      await notificationService.sendJobCompletionNotification(
        notificationSettings.userId,
        notificationSettings.email,
        jobStats,
        jobDetails,
        jobDetails.configUsed
      );
    } catch (error) {
      console.error("❌ Failed to send bulk completion notification:", error);
    }
  }

  async testConnection(config: EmailConfig): Promise<boolean> {
    try {
      const testTransporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.auth,
      });

      await testTransporter.verify();
      return true;
    } catch (error) {
      console.error("SMTP connection test failed:", error);
      return false;
    }
  }
}

export const emailService = new EmailService();
