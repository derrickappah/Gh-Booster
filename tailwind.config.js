module.exports = {
  content: ['./*.html','./src/js/*.js',
    './docs/*.html'],
  darkMode: 'class', // or 'media' or false
  theme: {
    extend: {
      colors: {
        gray: {
          50:  '#f9f9f9',
          100: '#efefef',
          200:  '#cccccc',
          300:  '#b6b6b6',
          400:  '#d9d9d9',
          500:  '#7d7d7d',
          600:  '#686465',
          700:  '#383838',
          800:  '#262626',
          850:  '#212121',
          900:  '#1c1c1c',
          950:  '#141414'
        },
        blue: {
          500:  '#99ecff',
          700:  '#68e1fd'
        },
      }
    },
    fontFamily: {
      sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
    },
  },
  variants: {
    extend: {
       backgroundOpacity: ['dark']
    }
  },
  plugins: [],
}