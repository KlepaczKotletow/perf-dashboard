import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Book, Mail, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-16">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-50 mb-4">
            Support & Help
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400">
            Get help with 360 Feedback for Slack
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-12">
          <Card>
            <CardHeader>
              <MessageSquare className="h-8 w-8 text-blue-600 mb-2" />
              <CardTitle>Getting Started</CardTitle>
              <CardDescription>Learn how to use 360 Feedback</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Quick Commands</h4>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <li><code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">/review</code> - Start a 360 review</li>
                  <li><code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">/feedback @user</code> - Give quick feedback</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Book className="h-8 w-8 text-green-600 mb-2" />
              <CardTitle>Documentation</CardTitle>
              <CardDescription>Detailed guides and tutorials</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li>• Setting up your first review cycle</li>
                <li>• Creating custom templates</li>
                <li>• Understanding analytics</li>
                <li>• Managing team roles</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-medium text-slate-900 dark:text-slate-50 mb-2">
                How do I start a 360 review?
              </h4>
              <p className="text-slate-600 dark:text-slate-400">
                Type <code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">/review</code> in any Slack channel. 
                A modal will appear where you can select the employee being reviewed, 
                add reviewers, and set a due date.
              </p>
            </div>

            <div>
              <h4 className="font-medium text-slate-900 dark:text-slate-50 mb-2">
                Can feedback be anonymous?
              </h4>
              <p className="text-slate-600 dark:text-slate-400">
                Yes! When giving feedback, you can choose to make it anonymous. 
                The recipient will see the feedback but not who sent it.
              </p>
            </div>

            <div>
              <h4 className="font-medium text-slate-900 dark:text-slate-50 mb-2">
                Who can see the feedback and reviews?
              </h4>
              <p className="text-slate-600 dark:text-slate-400">
                By default, managers and admins can see all feedback. Regular employees 
                can only see feedback they&apos;ve received or given. You can customize these 
                permissions in your workspace settings.
              </p>
            </div>

            <div>
              <h4 className="font-medium text-slate-900 dark:text-slate-50 mb-2">
                How do I access the dashboard?
              </h4>
              <p className="text-slate-600 dark:text-slate-400">
                Click &quot;Sign in with Slack&quot; on our homepage. You&apos;ll be authenticated 
                through your Slack account and redirected to your workspace dashboard.
              </p>
            </div>

            <div>
              <h4 className="font-medium text-slate-900 dark:text-slate-50 mb-2">
                Can I create custom review templates?
              </h4>
              <p className="text-slate-600 dark:text-slate-400">
                Yes! Managers and admins can create custom templates with different 
                questions, rating scales, and required fields. Go to Templates in 
                your dashboard to create and manage templates.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Mail className="h-8 w-8 text-purple-600 mb-2" />
            <CardTitle>Contact Support</CardTitle>
            <CardDescription>Need more help? We&apos;re here for you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600 dark:text-slate-400">
              If you can&apos;t find the answer you&apos;re looking for, reach out to our support team. 
              We typically respond within 24 hours.
            </p>
            <div className="flex gap-4">
              <Button asChild>
                <a href="mailto:support@360feedback.app">
                  <Mail className="h-4 w-4 mr-2" />
                  Email Support
                </a>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Back to Home
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
