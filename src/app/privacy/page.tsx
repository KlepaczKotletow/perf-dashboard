import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-16">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-50 mb-8">
          Privacy Policy
        </h1>
        
        <div className="prose dark:prose-invert max-w-none space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Introduction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-slate-600 dark:text-slate-400">
              <p>
                360 Feedback for Slack (&quot;we&quot;, &quot;our&quot;, or &quot;the App&quot;) is committed to protecting your privacy. 
                This Privacy Policy explains how we collect, use, and safeguard your information when you use our Slack application.
              </p>
              <p>
                By installing and using 360 Feedback, you agree to the collection and use of information in accordance with this policy.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Information We Collect</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-slate-600 dark:text-slate-400">
              <h3 className="font-semibold text-slate-900 dark:text-slate-50">From Slack:</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Workspace ID and name</li>
                <li>User IDs, display names, and email addresses</li>
                <li>Messages sent through our slash commands (/review, /feedback)</li>
              </ul>
              
              <h3 className="font-semibold text-slate-900 dark:text-slate-50 mt-4">User-Provided Information:</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Review responses and ratings</li>
                <li>Feedback messages</li>
                <li>Custom review templates</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How We Use Your Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-slate-600 dark:text-slate-400">
              <p>We use the collected information to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide the 360 feedback and performance review functionality</li>
                <li>Store and display feedback history in your dashboard</li>
                <li>Send notifications and reminders through Slack</li>
                <li>Generate analytics and reports for your workspace</li>
                <li>Improve our service and develop new features</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Storage and Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-slate-600 dark:text-slate-400">
              <ul className="list-disc pl-6 space-y-2">
                <li>All data is stored securely using industry-standard encryption</li>
                <li>We use Supabase for database hosting with Row Level Security (RLS)</li>
                <li>Each workspace&apos;s data is isolated and only accessible to members of that workspace</li>
                <li>We never share your data with third parties for marketing purposes</li>
                <li>Access tokens are stored securely and encrypted at rest</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Retention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-slate-600 dark:text-slate-400">
              <p>
                We retain your data for as long as the app is installed in your workspace. 
                Upon uninstallation, we will delete your workspace data within 30 days.
              </p>
              <p>
                You may request deletion of specific data or your entire workspace data at any time 
                by contacting our support.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Rights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-slate-600 dark:text-slate-400">
              <p>You have the right to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Access your personal data</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Export your data in a portable format</li>
                <li>Withdraw consent at any time by uninstalling the app</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Us</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-slate-600 dark:text-slate-400">
              <p>
                If you have any questions about this Privacy Policy or our data practices, 
                please contact us at:
              </p>
              <p className="font-medium">support@360feedback.app</p>
            </CardContent>
          </Card>

          <p className="text-sm text-slate-500 mt-8">
            Last updated: February 2026
          </p>
        </div>
      </div>
    </div>
  );
}
