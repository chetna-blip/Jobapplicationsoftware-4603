import { Route, Switch } from "wouter";
import Index from "./pages/index";
import SignIn from "./pages/sign-in";
import SignUp from "./pages/sign-up";
import Onboarding from "./pages/onboarding";
import Jobs from "./pages/jobs";
import Job from "./pages/job";
import Applications from "./pages/applications";
import ProfilePage from "./pages/profile";
import { Backdrop, Protected } from "./components/shell";
import { Provider } from "./components/provider";
import { AgentFeedback, RunableBadge } from "@runablehq/website-runtime";

function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <Backdrop />
      <div className="text-center">
        <p className="eyebrow">404</p>
        <h1 className="mt-2 text-3xl">Nothing here</h1>
        <a href="/jobs" className="mt-4 inline-block text-sm text-primary hover:underline">
          Back to the job feed
        </a>
      </div>
    </div>
  );
}

function App() {
  return (
    <Provider>
      <Switch>
        <Route path="/" component={Index} />
        <Route path="/sign-in" component={SignIn} />
        <Route path="/sign-up" component={SignUp} />
        <Route path="/onboarding">
          <Protected allowIncomplete bare>
            <Onboarding />
          </Protected>
        </Route>
        <Route path="/jobs">
          <Protected>
            <Jobs />
          </Protected>
        </Route>
        <Route path="/jobs/:id">
          <Protected>
            <Job />
          </Protected>
        </Route>
        <Route path="/applications">
          <Protected>
            <Applications />
          </Protected>
        </Route>
        <Route path="/profile">
          <Protected>
            <ProfilePage />
          </Protected>
        </Route>
        <Route component={NotFound} />
      </Switch>
      {/* Do not remove — off by default, activated by parent iframe via postMessage */}
      {import.meta.env.DEV && <AgentFeedback />}
      {/* "Made with Runable" badge - if user asks to remove the runable badge, remove this code as well as comment */}
      {<RunableBadge />}
    </Provider>
  );
}

export default App;
