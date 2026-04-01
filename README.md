# Personal Academic Website

A modern, professional personal website template designed for PhD students and academics. Built with HTML, CSS, and JavaScript - no framework dependencies required.

## Features

- 🎓 **Academic-focused design** - Perfect for PhD students and researchers
- 📱 **Fully responsive** - Works on all devices
- ⚡ **Fast loading** - No heavy frameworks or dependencies
- 🎨 **Modern UI** - Clean, professional design with smooth animations
- 📧 **Contact form** - Ready-to-use contact form with validation
- 🔍 **SEO optimized** - Proper meta tags and semantic HTML
- ♿ **Accessible** - WCAG compliant with keyboard navigation support

## Quick Start

1. **Clone or download** this repository
2. **Open `index.html`** in a web browser to preview
3. **Customize** the content with your information (see customization guide below)
4. **Deploy** to your preferred hosting platform

## Customization Guide

### 1. Personal Information

Replace the placeholder text in `index.html`:

- `[Your Name]` - Replace with your actual name
- `[Your Field]` - Your research field (e.g., "Computer Science", "Biology")
- `[University]` - Your university name
- `[Supervisor Name]` - Your PhD supervisor's name
- `[your research area]` - Your specific research interests
- `your.email@university.edu` - Your email address

### 2. Adding Your Photo

Replace the profile placeholder:

1. Add your photo file to the project folder (e.g., `photo.jpg`)
2. In `index.html`, replace the profile placeholder section:

```html
<div class="hero-image">
    <img src="photo.jpg" alt="Your Name" class="profile-photo">
</div>
```

3. Add this CSS to `style.css`:

```css
.profile-photo {
    width: 300px;
    height: 300px;
    border-radius: 50%;
    object-fit: cover;
    border: 5px solid rgba(255, 255, 255, 0.2);
}
```

### 3. Updating Skills

Modify the skills section in `index.html`:

```html
<div class="skill-item">
    <i class="fas fa-your-icon"></i>
    <h4>Your Skill</h4>
    <p>Description</p>
</div>
```

### 4. Adding Research Projects

Update the project cards in the research section:

```html
<div class="project-card">
    <h4>Your Project Title</h4>
    <p>Project description and significance.</p>
    <div class="project-tags">
        <span class="tag">Keyword 1</span>
        <span class="tag">Keyword 2</span>
    </div>
</div>
```

### 5. Publications

As you publish papers, update the publications section:

```html
<div class="publication-item">
    <h4>Paper Title (2024)</h4>
    <p class="authors"><strong>Your Name</strong>, Co-author</p>
    <p class="journal">Journal Name</p>
    <p class="description">Brief description of the paper.</p>
</div>
```

### 6. Contact Information

Update your contact details in the contact section:

```html
<div class="contact-item">
    <i class="fas fa-envelope"></i>
    <div>
        <h4>Email</h4>
        <p>your.email@university.edu</p>
    </div>
</div>
```

### 7. Colors and Styling

The website uses a blue color scheme. To change colors, modify these CSS variables in `style.css`:

```css
:root {
    --primary-color: #2563eb;    /* Main blue */
    --secondary-color: #1d4ed8;  /* Darker blue */
    --accent-color: #fbbf24;     /* Yellow highlight */
    --text-color: #1f2937;       /* Dark gray */
    --light-bg: #f8fafc;         /* Light background */
}
```

## Deployment Options

### Option 1: GitHub Pages (Free)

1. Create a GitHub repository
2. Upload your files to the repository
3. Go to Settings → Pages
4. Select "Deploy from a branch" and choose `main`
5. Your site will be available at `https://username.github.io/repository-name`

### Option 2: Netlify (Free)

1. Create a Netlify account
2. Drag and drop your project folder to Netlify
3. Your site will be deployed automatically
4. You can connect a custom domain if desired

### Option 3: Vercel (Free)

1. Create a Vercel account
2. Import your project from GitHub or upload directly
3. Your site will be deployed automatically

### Option 4: Traditional Web Hosting

Upload all files to your web hosting provider's public folder (usually `public_html` or `www`).

## Contact Form Setup

The contact form currently shows an alert message. To make it functional:

### Option 1: Netlify Forms

1. Deploy to Netlify
2. Add `netlify` attribute to your form:
   ```html
   <form id="contactForm" netlify>
   ```

### Option 2: Formspree

1. Sign up at [formspree.io](https://formspree.io)
2. Update your form action:
   ```html
   <form id="contactForm" action="https://formspree.io/f/your-form-id" method="POST">
   ```

### Option 3: EmailJS

1. Sign up at [emailjs.com](https://emailjs.com)
2. Follow their JavaScript integration guide
3. Update the form submission handler in `script.js`

## Adding a Blog (Optional)

To add a blog section:

1. Create a `blog` folder
2. Add individual HTML files for blog posts
3. Create a blog index page
4. Update the navigation to include a blog link

## Performance Optimization

- **Images**: Optimize images using tools like TinyPNG
- **Fonts**: The site uses Google Fonts (Inter) - consider self-hosting for better performance
- **Minification**: Use tools like HTMLMinifier, CSSNano, and UglifyJS for production

## Browser Support

- Chrome/Chromium (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- IE11+ (with some limitations)

## Contributing

Feel free to submit issues and pull requests to improve this template!

## License

This template is free to use for personal and academic purposes.

---

## Checklist for PhD Students

Before deploying your website, make sure you've:

- [ ] Added your personal information
- [ ] Uploaded your professional photo
- [ ] Updated your research interests and projects
- [ ] Added your contact information
- [ ] Customized the colors to match your preferences
- [ ] Tested the website on different devices
- [ ] Set up the contact form (if needed)
- [ ] Checked all links work correctly
- [ ] Optimized images for web
- [ ] Added proper meta descriptions for SEO

## Tips for Academic Websites

1. **Keep it simple**: Focus on content over flashy effects
2. **Update regularly**: Add new publications and projects as they happen
3. **Professional photo**: Use a high-quality, professional headshot
4. **Clear navigation**: Make it easy for visitors to find what they need
5. **Mobile-friendly**: Many people will view your site on phones
6. **Fast loading**: Academic visitors value speed and efficiency
7. **Accessibility**: Ensure your site works for users with disabilities

Good luck with your PhD journey! 🎓 